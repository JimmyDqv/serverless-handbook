"""GET /orders - Get orders for authenticated user."""

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
def get_user_orders_from_db(user_key: str, include_completed: bool = False) -> list:
    """Get orders for a specific user."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if include_completed:
                cur.execute(
                    """
                    SELECT o.id, o.drink_id, o.user_key, o.status,
                           o.created_at, o.updated_at, o.completed_at,
                           d.name as drink_name, d.image_url as drink_image_url
                    FROM cocktails.orders o
                    JOIN cocktails.drinks d ON o.drink_id = d.id
                    WHERE o.user_key = %s
                    ORDER BY o.created_at DESC
                    LIMIT 50
                    """,
                    [user_key],
                )
            else:
                cur.execute(
                    """
                    SELECT o.id, o.drink_id, o.user_key, o.status,
                           o.created_at, o.updated_at, o.completed_at,
                           d.name as drink_name, d.image_url as drink_image_url
                    FROM cocktails.orders o
                    JOIN cocktails.drinks d ON o.drink_id = d.id
                    WHERE o.user_key = %s
                      AND o.status IN ('pending', 'in_progress')
                    ORDER BY o.created_at DESC
                    """,
                    [user_key],
                )
            return cur.fetchall()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Get orders for authenticated user. Supports ?include_completed=true."""
    try:
        user_key, username = get_user_context(event)

        if not user_key:
            return response(401, {
                "success": False,
                "error": {"code": "UNAUTHORIZED", "message": "Authentication required"},
            })

        params = event.get("queryStringParameters") or {}
        include_completed = params.get("include_completed", "").lower() == "true"

        rows = get_user_orders_from_db(user_key, include_completed)

        orders = [
            {
                "id": row["id"],
                "drink": {
                    "id": row["drink_id"],
                    "name": row["drink_name"],
                    "image_url": row["drink_image_url"],
                },
                "user_key": str(row["user_key"]) if row["user_key"] else None,
                "status": row["status"],
                "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() + "Z" if row["updated_at"] else None,
                "completed_at": row["completed_at"].isoformat() + "Z" if row["completed_at"] else None,
            }
            for row in rows
        ]

        logger.info("Retrieved user orders", extra={"user_key": user_key, "count": len(orders)})
        return response(200, {"success": True, "data": orders})

    except Exception:
        logger.exception("Failed to get user orders")
        return response(500, {
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": "Failed to retrieve orders"},
        })
