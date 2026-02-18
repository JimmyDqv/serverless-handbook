"""GET /admin/registration-codes - List registration codes."""

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


def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


@tracer.capture_method
def get_registration_codes(status: str | None = None) -> list[dict]:
    """Get registration codes, optionally filtered by status (active/used/expired)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            base_query = """
                SELECT
                    code,
                    created_at,
                    created_by,
                    expires_at,
                    is_used,
                    used_at,
                    used_by_user_key,
                    notes,
                    COALESCE(max_uses, 1) as max_uses,
                    COALESCE(use_count, CASE WHEN is_used THEN 1 ELSE 0 END) as use_count
                FROM cocktails.registration_codes
            """

            conditions = []
            params = []

            if status == "active":
                # Not fully used and not expired (use_count < max_uses)
                conditions.append("COALESCE(use_count, CASE WHEN is_used THEN 1 ELSE 0 END) < COALESCE(max_uses, 1)")
                conditions.append("expires_at > CURRENT_TIMESTAMP")
            elif status == "used":
                # Fully used (use_count >= max_uses)
                conditions.append("COALESCE(use_count, CASE WHEN is_used THEN 1 ELSE 0 END) >= COALESCE(max_uses, 1)")
            elif status == "expired":
                # Not fully used but expired
                conditions.append("COALESCE(use_count, CASE WHEN is_used THEN 1 ELSE 0 END) < COALESCE(max_uses, 1)")
                conditions.append("expires_at <= CURRENT_TIMESTAMP")

            if conditions:
                base_query += " WHERE " + " AND ".join(conditions)

            base_query += " ORDER BY created_at DESC LIMIT 100"

            cur.execute(base_query, params)
            rows = cur.fetchall()

            logger.info(
                "Retrieved registration codes",
                extra={"count": len(rows), "status_filter": status},
            )

            return rows


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle admin registration codes listing."""
    try:
        query_params = event.get("queryStringParameters") or {}
        status = query_params.get("status")

        valid_statuses = ["active", "used", "expired", None]
        if status and status not in valid_statuses:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": f"Invalid status. Must be one of: active, used, expired",
                    },
                },
            )

        rows = get_registration_codes(status=status)

        frontend_url = os.environ.get("FRONTEND_URL", "")

        codes = []
        for row in rows:
            code_data = {
                "code": str(row["code"]),
                "created_at": (
                    row["created_at"].isoformat() + "Z" if row["created_at"] else None
                ),
                "created_by": row["created_by"],
                "expires_at": (
                    row["expires_at"].isoformat() + "Z" if row["expires_at"] else None
                ),
                "is_used": row["is_used"],
                "used_at": (
                    row["used_at"].isoformat() + "Z" if row["used_at"] else None
                ),
                "used_by_user_key": (
                    str(row["used_by_user_key"]) if row["used_by_user_key"] else None
                ),
                "notes": row["notes"],
                "max_uses": row["max_uses"],
                "use_count": row["use_count"],
                "registration_url": f"{frontend_url}/register?code={row['code']}",
            }
            codes.append(code_data)

        return response(200, {"success": True, "data": codes})

    except Exception as e:
        logger.exception("Failed to get registration codes")
        return response(
            500,
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to retrieve registration codes",
                },
            },
        )
