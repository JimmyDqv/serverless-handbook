"""GET /admin/orders - Get all orders for admin queue."""

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


def response(status_code: int, body: dict, origin: str = "*") -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(body),
    }


@tracer.capture_method
def get_order_counts(conn) -> dict:
    """Get counts for each order status."""
    with conn.cursor() as cur:
        # Get pending count
        cur.execute("SELECT COUNT(*) as count FROM cocktails.orders WHERE status = 'pending'")
        pending_count = cur.fetchone()["count"]

        # Get in_progress count
        cur.execute("SELECT COUNT(*) as count FROM cocktails.orders WHERE status = 'in_progress'")
        in_progress_count = cur.fetchone()["count"]

        # Get completed count (last 24 hours)
        cur.execute(
            """
            SELECT COUNT(*) as count FROM cocktails.orders
            WHERE status = 'completed'
            AND completed_at >= NOW() - INTERVAL '24 hours'
            """
        )
        completed_24h_count = cur.fetchone()["count"]

    return {
        "pending_count": pending_count,
        "in_progress_count": in_progress_count,
        "completed_24h_count": completed_24h_count,
    }


@tracer.capture_method
def get_orders_from_db(pending_limit: int = 25):
    """
    Get orders for admin queue with priority:
    1. All in_progress orders (no limit)
    2. Pending orders (max pending_limit, oldest first)
    3. No completed orders
    """
    with get_connection() as conn:
        # Get counts first
        counts = get_order_counts(conn)

        with conn.cursor() as cur:
            # Get ALL in_progress orders
            cur.execute(
                """
                SELECT o.id, o.drink_id, o.user_session_id, o.user_key, o.status,
                       o.created_at, o.updated_at, o.completed_at,
                       d.name as drink_name, d.image_url as drink_image_url,
                       u.username
                FROM cocktails.orders o
                JOIN cocktails.drinks d ON o.drink_id = d.id
                LEFT JOIN cocktails.app_users u ON o.user_key = u.user_key
                WHERE o.status = 'in_progress'
                ORDER BY o.created_at ASC
                """
            )
            in_progress_orders = cur.fetchall()

            # Get pending orders (limited)
            cur.execute(
                """
                SELECT o.id, o.drink_id, o.user_session_id, o.user_key, o.status,
                       o.created_at, o.updated_at, o.completed_at,
                       d.name as drink_name, d.image_url as drink_image_url,
                       u.username
                FROM cocktails.orders o
                JOIN cocktails.drinks d ON o.drink_id = d.id
                LEFT JOIN cocktails.app_users u ON o.user_key = u.user_key
                WHERE o.status = 'pending'
                ORDER BY o.created_at ASC
                LIMIT %s
                """,
                [pending_limit],
            )
            pending_orders = cur.fetchall()

        # Combine: in_progress first, then pending
        all_orders = list(in_progress_orders) + list(pending_orders)

        return all_orders, counts, len(pending_orders)


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    try:
        params = event.get("queryStringParameters") or {}
        pending_limit = params.get("pending_limit", "25")

        try:
            pending_limit = min(int(pending_limit), 100)
        except ValueError:
            pending_limit = 25

        rows, counts, pending_returned = get_orders_from_db(pending_limit)

        orders = [
            {
                "id": row["id"],
                "drink": {
                    "id": row["drink_id"],
                    "name": row["drink_name"],
                    "image_url": row["drink_image_url"],
                },
                "user_session_id": row["user_session_id"],
                "user_key": str(row["user_key"]) if row["user_key"] else None,
                "username": row["username"],
                "status": row["status"],
                "created_at": (
                    row["created_at"].isoformat() + "Z" if row["created_at"] else None
                ),
                "updated_at": (
                    row["updated_at"].isoformat() + "Z" if row["updated_at"] else None
                ),
                "completed_at": (
                    row["completed_at"].isoformat() + "Z"
                    if row["completed_at"]
                    else None
                ),
            }
            for row in rows
        ]

        metadata = {
            "pending_count": counts["pending_count"],
            "in_progress_count": counts["in_progress_count"],
            "completed_24h_count": counts["completed_24h_count"],
            "pending_returned": pending_returned,
        }

        logger.info(
            "Retrieved orders",
            extra={"count": len(orders), "metadata": metadata},
        )
        return response(200, {"data": orders, "metadata": metadata})

    except Exception as e:
        logger.exception("Failed to get orders")
        return response(500, {"error": "Internal server error"})
