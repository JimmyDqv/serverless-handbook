"""PUT /admin/orders/{id} - Update order status."""

import json
import os
from contextlib import contextmanager
from datetime import datetime

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

from event_publisher import publish_order_status_changed

tracer = Tracer()
logger = Logger()

VALID_STATUSES = {'pending', 'in_progress', 'completed', 'cancelled'}

_db_config = None


def get_db_config():
    global _db_config
    if _db_config is None:
        _db_config = {
            'endpoint': os.environ.get('DSQL_CLUSTER_ENDPOINT', ''),
            'region': os.environ.get('AWS_REGION', 'eu-west-1'),
            'role_arn': os.environ.get('DATABASE_WRITER_ROLE', ''),
            'user': os.environ.get('DATABASE_USER', 'admin'),
        }
    return _db_config


@tracer.capture_method
def get_auth_token(endpoint: str, region: str, role_arn: str) -> str:
    if role_arn:
        sts = boto3.client('sts', region_name=region)
        creds = sts.assume_role(RoleArn=role_arn, RoleSessionName='dsql-session')['Credentials']
        dsql = boto3.client(
            'dsql',
            region_name=region,
            aws_access_key_id=creds['AccessKeyId'],
            aws_secret_access_key=creds['SecretAccessKey'],
            aws_session_token=creds['SessionToken'],
        )
    else:
        dsql = boto3.client('dsql', region_name=region)
    return dsql.generate_db_connect_auth_token(Hostname=endpoint, Region=region)


@contextmanager
def get_connection():
    config = get_db_config()
    token = get_auth_token(config['endpoint'], config['region'], config['role_arn'])
    conn = psycopg2.connect(
        host=config['endpoint'],
        port=5432,
        database='postgres',
        user=config['user'],
        password=token,
        sslmode='require',
        cursor_factory=RealDictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()


def response(status_code: int, body: dict, origin: str = '*') -> dict:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
            'Access-Control-Allow-Methods': 'PUT,OPTIONS',
        },
        'body': json.dumps(body),
    }


@tracer.capture_method
def update_order_in_db(order_id: str, new_status: str):
    now = datetime.utcnow()
    completed_at = now if new_status == 'completed' else None

    with get_connection() as conn:
        with conn.cursor() as cur:
            # First get the current status for event publishing
            cur.execute("""
                SELECT status FROM cocktails.orders WHERE id = %s
            """, [order_id])
            current = cur.fetchone()
            old_status = current['status'] if current else None

            cur.execute("""
                UPDATE cocktails.orders
                SET status = %s, updated_at = %s, completed_at = %s
                WHERE id = %s
                RETURNING id, drink_id, user_session_id, user_key, status, created_at, updated_at, completed_at
            """, [new_status, now, completed_at, order_id])
            row = cur.fetchone()

            if row:
                # Fetch drink info for the response
                cur.execute("""
                    SELECT name, image_url FROM cocktails.drinks WHERE id = %s
                """, [row['drink_id']])
                drink = cur.fetchone()
                if drink:
                    row['drink_name'] = drink['name']
                    row['drink_image_url'] = drink['image_url']
                row['old_status'] = old_status

            conn.commit()
            return row


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    # Get origin for CORS
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin') or '*'
    
    try:
        order_id = event.get('pathParameters', {}).get('id')
        if not order_id:
            return response(400, {'error': 'Order ID is required'}, origin)

        body = json.loads(event.get('body') or '{}')
        # Handle double-stringified JSON from Amplify
        if isinstance(body, str):
            body = json.loads(body)
        new_status = body.get('status')

        if not new_status:
            return response(400, {'error': 'status is required'}, origin)
        if new_status not in VALID_STATUSES:
            return response(400, {'error': f'Invalid status. Must be one of: {", ".join(VALID_STATUSES)}'}, origin)

        row = update_order_in_db(order_id, new_status)

        if not row:
            return response(404, {'error': 'Order not found'}, origin)

        # Get user_key for event publishing (may be same as user_session_id)
        user_key = row.get('user_key') or row['user_session_id']
        old_status = row.get('old_status')

        order = {
            'id': row['id'],
            'drink': {
                'id': row['drink_id'],
                'name': row.get('drink_name', ''),
                'image_url': row.get('drink_image_url', ''),
            },
            'user_session_id': row['user_session_id'],
            'user_key': user_key,
            'status': row['status'],
            'created_at': row['created_at'].isoformat() + 'Z' if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() + 'Z' if row['updated_at'] else None,
            'completed_at': row['completed_at'].isoformat() + 'Z' if row['completed_at'] else None,
        }

        logger.info("Updated order", extra={'order_id': order_id, 'new_status': new_status})

        # Publish real-time event for status change
        try:
            publish_order_status_changed(order, user_key, old_status)
        except Exception as e:
            logger.warning(
                "Failed to publish order status changed event",
                extra={"order_id": order_id, "error": str(e)},
            )

        return response(200, {'data': order}, origin)

    except json.JSONDecodeError:
        return response(400, {'error': 'Invalid JSON body'}, origin)
    except Exception as e:
        logger.exception("Failed to update order")
        return response(500, {'error': 'Internal server error'}, origin)
