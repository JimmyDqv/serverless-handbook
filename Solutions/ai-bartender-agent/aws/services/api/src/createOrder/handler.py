"""POST /orders - Create a new drink order."""

import json
import os
import uuid
from contextlib import contextmanager
from datetime import datetime

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

from event_publisher import publish_order_created

tracer = Tracer()
logger = Logger()

_db_config = None


def get_db_config():
    """Get database configuration from environment."""
    global _db_config
    if _db_config is None:
        _db_config = {
            "endpoint": os.environ.get("DSQL_CLUSTER_ENDPOINT", ""),
            "region": os.environ.get("AWS_REGION", "eu-west-1"),
            "role_arn": os.environ.get("DATABASE_WRITER_ROLE", ""),
            "user": os.environ.get("DATABASE_USER", "admin"),
        }
    return _db_config


@tracer.capture_method
def get_auth_token(endpoint: str, region: str, role_arn: str) -> str:
    """Generate AWS IAM authentication token for DSQL."""
    if role_arn:
        sts = boto3.client("sts", region_name=region)
        creds = sts.assume_role(RoleArn=role_arn, RoleSessionName="dsql-session")[
            "Credentials"
        ]
        dsql = boto3.client(
            "dsql",
            region_name=region,
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )
    else:
        dsql = boto3.client("dsql", region_name=region)
    return dsql.generate_db_connect_auth_token(Hostname=endpoint, Region=region)


@contextmanager
def get_connection():
    """Get database connection with IAM authentication."""
    config = get_db_config()
    token = get_auth_token(config["endpoint"], config["region"], config["role_arn"])
    conn = psycopg2.connect(
        host=config["endpoint"],
        port=5432,
        database="postgres",
        user=config["user"],
        password=token,
        sslmode="require",
        cursor_factory=RealDictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()


def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def get_user_context(event: dict):
    """Extract (user_key, username) from authorizer context."""
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    user_key = authorizer.get("user_key")
    username = authorizer.get("username")
    return user_key, username


@tracer.capture_method
def create_order_in_db(drink_id: str, user_key: str):
    """Create order for authenticated user. Returns (order_data, error_code)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, image_url FROM cocktails.drinks WHERE id = %s AND is_active = true",
                [drink_id],
            )
            drink = cur.fetchone()
            if not drink:
                return None, "drink_not_found"

            cur.execute(
                """
                SELECT id FROM cocktails.orders
                WHERE user_key = %s AND status IN ('pending', 'in_progress')
                """,
                [user_key],
            )
            if cur.fetchone():
                return None, "active_order_exists"

            # user_session_id uses user_key as placeholder (NOT NULL constraint in DSQL)
            order_id = str(uuid.uuid4())
            now = datetime.utcnow()
            cur.execute(
                """
                INSERT INTO cocktails.orders (id, drink_id, user_key, user_session_id, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'pending', %s, %s)
                RETURNING id, drink_id, user_key, status, created_at
                """,
                [order_id, drink_id, user_key, user_key, now, now],
            )
            row = cur.fetchone()
            conn.commit()

            row["drink_name"] = drink["name"]
            row["drink_image_url"] = drink["image_url"]

            return row, None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle order creation for authenticated users."""
    try:
        user_key, username = get_user_context(event)

        if not user_key:
            return response(401, {
                "success": False,
                "error": {"code": "UNAUTHORIZED", "message": "Authentication required"},
            })

        try:
            body = json.loads(event.get("body") or "{}")
            if isinstance(body, str):
                body = json.loads(body)
        except json.JSONDecodeError:
            return response(400, {
                "success": False,
                "error": {"code": "INVALID_REQUEST", "message": "Invalid JSON body"},
            })

        drink_id = body.get("drink_id")
        if not drink_id:
            return response(400, {
                "success": False,
                "error": {"code": "INVALID_REQUEST", "message": "drink_id is required"},
            })

        row, error = create_order_in_db(drink_id, user_key)

        if error == "drink_not_found":
            return response(404, {
                "success": False,
                "error": {"code": "NOT_FOUND", "message": "Drink not found or inactive"},
            })

        if error == "active_order_exists":
            return response(409, {
                "success": False,
                "error": {"code": "CONFLICT", "message": "You already have an active order"},
            })

        order = {
            "id": row["id"],
            "drink": {
                "id": row["drink_id"],
                "name": row["drink_name"],
                "image_url": row["drink_image_url"],
            },
            "user_session_id": row["user_key"],
            "user_key": row["user_key"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
        }

        logger.info("Created order", extra={"order_id": row["id"], "drink_id": drink_id, "user_key": user_key})

        try:
            publish_order_created(order, user_key)
        except Exception:
            logger.warning("Failed to publish order created event", extra={"order_id": order["id"]})

        return response(201, {"success": True, "data": order})

    except Exception:
        logger.exception("Failed to create order")
        return response(500, {
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": "Failed to create order"},
        })
