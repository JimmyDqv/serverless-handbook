"""PUT /admin/sections/{id} - Update an existing section."""

import json
import os
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
            "Access-Control-Allow-Methods": "PUT,OPTIONS",
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
def update_section_in_db(section_id: str, section_data: dict):
    """Update an existing section in the database."""
    now = datetime.utcnow()

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Check section exists
            cur.execute(
                "SELECT id FROM cocktails.sections WHERE id = %s",
                [section_id],
            )
            if not cur.fetchone():
                return None, "not_found"

            # Check for duplicate display_order (excluding current section)
            if "display_order" in section_data:
                cur.execute(
                    "SELECT id FROM cocktails.sections WHERE display_order = %s AND id != %s",
                    [section_data["display_order"], section_id],
                )
                if cur.fetchone():
                    return None, "display_order_exists"

            # Build dynamic update query
            update_fields = []
            update_values = []

            if "name" in section_data:
                update_fields.append("name = %s")
                update_values.append(section_data["name"])
            if "display_order" in section_data:
                update_fields.append("display_order = %s")
                update_values.append(section_data["display_order"])

            update_fields.append("updated_at = %s")
            update_values.append(now)
            update_values.append(section_id)

            cur.execute(
                f"""
                UPDATE cocktails.sections
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id, name, display_order, created_at, updated_at
                """,
                update_values,
            )
            row = cur.fetchone()
            conn.commit()
            return row, None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle PUT /admin/sections/{id} request."""
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        # Get section ID from path parameters
        path_params = event.get("pathParameters") or {}
        section_id = path_params.get("id")

        if not section_id:
            return response(400, {"error": "Section ID is required"}, origin)

        # Parse request body
        body, parse_error = parse_body(event)
        if parse_error:
            return response(400, {"error": parse_error}, origin)

        # Build update data
        section_data = {}
        if "name" in body:
            section_data["name"] = body["name"]
        if "display_order" in body:
            try:
                section_data["display_order"] = int(body["display_order"])
            except (ValueError, TypeError):
                return response(
                    400, {"error": "display_order must be an integer"}, origin
                )

        if not section_data:
            return response(400, {"error": "No fields to update"}, origin)

        # Update section in database
        row, db_error = update_section_in_db(section_id, section_data)

        if db_error == "not_found":
            return response(404, {"error": "Section not found"}, origin)
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

        logger.info("Updated section", extra={"section_id": section_id})

        # Flush API Gateway cache to ensure updated section is visible
        flush_api_cache()

        return response(200, {"data": section}, origin)

    except Exception:
        logger.exception("Failed to update section")
        return response(500, {"error": "Internal server error"}, origin)
