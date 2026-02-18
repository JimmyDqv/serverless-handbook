"""GET /sections - Returns all drink sections."""

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


def response(status_code: int, body: dict, headers: dict = None) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",  # Let API Gateway handle caching, not browser
            **(headers or {}),
        },
        "body": json.dumps(body),
    }


@tracer.capture_method
def get_sections_from_db():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, display_order, created_at
                FROM cocktails.sections
                ORDER BY display_order, name
            """
            )
            return cur.fetchall()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    try:
        rows = get_sections_from_db()

        sections = [
            {
                "id": row["id"],
                "name": row["name"],
                "display_order": row["display_order"],
                "created_at": (
                    row["created_at"].isoformat() + "Z" if row["created_at"] else None
                ),
            }
            for row in rows
        ]

        logger.info("Retrieved sections", extra={"count": len(sections)})
        return response(200, {"data": sections})

    except Exception as e:
        logger.exception("Failed to get sections")
        return response(500, {"error": "Internal server error"})
