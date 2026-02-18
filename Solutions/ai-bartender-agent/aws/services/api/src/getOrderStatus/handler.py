"""GET /orders/{id} - Get order status by ID for authenticated user."""

import json
import os
from contextlib import contextmanager

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

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
            "role_arn": os.environ.get("DATABASE_READER_ROLE", ""),
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
    return authorizer.get("user_key"), authorizer.get("username")


@tracer.capture_method
def get_order_from_db(order_id: str, user_key: str):
    """Get order with user ownership verification. Returns (order_data, error_code)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT o.id, o.drink_id, o.user_key, o.user_session_id, o.status,
                       o.created_at, o.updated_at, o.completed_at,
                       d.name as drink_name, d.image_url as drink_image_url
                FROM cocktails.orders o
                JOIN cocktails.drinks d ON o.drink_id = d.id
                WHERE o.id = %s
                """,
                [order_id],
            )
            row = cur.fetchone()

            if not row:
                return None, "not_found"

            if row["user_key"] and str(row["user_key"]) != user_key:
                logger.warning(
                    "User attempted to access another user's order",
                    extra={"order_id": order_id, "requesting_user_key": user_key},
                )
                return None, "forbidden"

            return row, None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Get order status. Users can only access their own orders."""
    try:
        user_key, username = get_user_context(event)

        if not user_key:
            return response(401, {
                "success": False,
                "error": {"code": "UNAUTHORIZED", "message": "Authentication required"},
            })

        order_id = event.get("pathParameters", {}).get("id")
        if not order_id:
            return response(400, {
                "success": False,
                "error": {"code": "INVALID_REQUEST", "message": "Order ID is required"},
            })

        row, error = get_order_from_db(order_id, user_key)

        if error == "not_found":
            return response(404, {
                "success": False,
                "error": {"code": "NOT_FOUND", "message": "Order not found"},
            })

        if error == "forbidden":
            return response(403, {
                "success": False,
                "error": {"code": "FORBIDDEN", "message": "You do not have permission to view this order"},
            })

        order = {
            "id": row["id"],
            "drink": {
                "id": row["drink_id"],
                "name": row["drink_name"],
                "image_url": row["drink_image_url"],
            },
            "user_session_id": row["user_session_id"],
            "user_key": str(row["user_key"]) if row["user_key"] else None,
            "status": row["status"],
            "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() + "Z" if row["updated_at"] else None,
            "completed_at": row["completed_at"].isoformat() + "Z" if row["completed_at"] else None,
        }

        logger.info("Retrieved order", extra={"order_id": order_id, "user_key": user_key})
        return response(200, {"success": True, "data": order})

    except Exception:
        logger.exception("Failed to get order")
        return response(500, {
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": "Failed to retrieve order"},
        })
