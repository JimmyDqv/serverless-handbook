"""GET /drinks - Returns drinks with optional section filtering."""

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


def response(status_code: int, body: dict, headers: dict = None) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
            **(headers or {}),
        },
        "body": json.dumps(body),
    }


def parse_ingredients(ingredients):
    """Parse ingredients from JSON string or return as-is if already a list."""
    if isinstance(ingredients, str):
        try:
            return json.loads(ingredients)
        except json.JSONDecodeError:
            return []
    return ingredients if isinstance(ingredients, list) else []


@tracer.capture_method
def get_drinks_from_db(section_id: str = None) -> list:
    """Get active drinks. Recipe excluded for compact list response."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if section_id:
                cur.execute(
                    """
                    SELECT id, section_id, name, description,
                           ingredients, image_url, is_active, created_at
                    FROM cocktails.drinks
                    WHERE section_id = %s AND is_active = true
                    ORDER BY name
                    """,
                    [section_id],
                )
            else:
                cur.execute(
                    """
                    SELECT id, section_id, name, description,
                           ingredients, image_url, is_active, created_at
                    FROM cocktails.drinks
                    WHERE is_active = true
                    ORDER BY name
                    """
                )
            return cur.fetchall()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    try:
        params = event.get("queryStringParameters") or {}
        section_id = params.get("section_id")

        rows = get_drinks_from_db(section_id)

        drinks = [
            {
                "id": row["id"],
                "section_id": row["section_id"],
                "name": row["name"],
                "description": row["description"] or "",
                "ingredients": parse_ingredients(row["ingredients"]),
                "image_url": row["image_url"] or "",
            }
            for row in rows
        ]

        logger.info("Retrieved drinks", extra={"count": len(drinks), "section_id": section_id})
        return response(200, {"data": drinks})

    except Exception:
        logger.exception("Failed to get drinks")
        return response(500, {"error": "Internal server error"})
