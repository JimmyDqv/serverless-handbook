"""POST /admin/sections - Create a new section."""

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

import sys
sys.path.insert(0, "/opt/python")
from shared.cache_utils import flush_api_cache

tracer = Tracer()
logger = Logger()

_db_config = None


def get_db_config():
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
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def parse_body(event: dict) -> tuple[dict | None, str | None]:
    """Parse request body handling string, dict, and double-encoded JSON."""
    raw_body = event.get("body")

    if raw_body is None:
        return {}, None

    if isinstance(raw_body, dict):
        return raw_body, None

    if not isinstance(raw_body, str):
        return None, f"Unexpected body type: {type(raw_body)}"

    try:
        body = json.loads(raw_body)
        # Handle double-encoded JSON (string containing JSON string)
        if isinstance(body, str):
            body = json.loads(body)
        return body, None
    except (json.JSONDecodeError, TypeError):
        return None, "Invalid JSON in request body"


@tracer.capture_method
def create_section_in_db(section_name: str, display_order: int):
    """Insert a new section into the database."""
    section_id = str(uuid.uuid4())
    now = datetime.utcnow()

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Check for duplicate display_order
            cur.execute(
                "SELECT id FROM cocktails.sections WHERE display_order = %s",
                [display_order],
            )
            if cur.fetchone():
                return None, "display_order_exists"

            cur.execute(
                """
                INSERT INTO cocktails.sections
                (id, name, display_order, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, display_order, created_at, updated_at
                """,
                [section_id, section_name, display_order, now, now],
            )
            row = cur.fetchone()
            conn.commit()
            return row, None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle POST /admin/sections request."""
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        # Parse request body
        body, parse_error = parse_body(event)
        if parse_error:
            return response(400, {"error": parse_error}, origin)

        # Extract and validate fields
        section_name = body.get("name")
        display_order = body.get("display_order")

        if not section_name:
            return response(400, {"error": "name is required"}, origin)
        if display_order is None:
            return response(400, {"error": "display_order is required"}, origin)

        try:
            display_order = int(display_order)
        except (ValueError, TypeError):
            return response(400, {"error": "display_order must be an integer"}, origin)

        # Create section in database
        row, db_error = create_section_in_db(section_name, display_order)

        if db_error == "display_order_exists":
            return response(
                409,
                {"error": "A section with this display order already exists"},
                origin,
            )

        # Build response
        section = {
            "id": row["id"],
            "name": row["name"],
            "display_order": row["display_order"],
            "created_at": (
                row["created_at"].isoformat() + "Z" if row["created_at"] else None
            ),
            "updated_at": (
                row["updated_at"].isoformat() + "Z" if row["updated_at"] else None
            ),
        }

        # Note: 'name' is reserved in Python logging, use 'section_name' instead
        logger.info(
            "Created section",
            extra={"section_id": row["id"], "section_name": section_name},
        )

        # Flush API Gateway cache to ensure new section is visible
        flush_api_cache()

        return response(201, {"data": section}, origin)

    except Exception:
        logger.exception("Failed to create section")
        return response(500, {"error": "Internal server error"}, origin)
