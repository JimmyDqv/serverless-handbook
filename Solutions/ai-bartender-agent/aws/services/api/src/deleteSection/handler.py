"""DELETE /admin/sections/{id} - Delete a section."""

import json
import os
from contextlib import contextmanager

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
            "Access-Control-Allow-Methods": "DELETE,OPTIONS",
        },
        "body": json.dumps(body),
    }


@tracer.capture_method
def delete_section_from_db(section_id: str):
    """Delete section if it has no drinks. Returns (result, error)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name FROM cocktails.sections WHERE id = %s",
                [section_id],
            )
            section = cur.fetchone()
            if not section:
                return None, "not_found"

            cur.execute(
                "SELECT COUNT(*) as count FROM cocktails.drinks WHERE section_id = %s",
                [section_id],
            )
            drink_count = cur.fetchone()["count"]

            if drink_count > 0:
                return {
                    "drink_count": drink_count,
                    "section_name": section["name"],
                }, "has_drinks"

            cur.execute("DELETE FROM cocktails.sections WHERE id = %s", [section_id])
            conn.commit()
            return {"deleted": True}, None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    # Get origin for CORS
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        # Get section ID from path parameters
        path_params = event.get("pathParameters") or {}
        section_id = path_params.get("id")

        if not section_id:
            return response(400, {"error": "Section ID is required"}, origin)

        result, error = delete_section_from_db(section_id)

        if error == "not_found":
            return response(404, {"error": "Section not found"}, origin)

        if error == "has_drinks":
            return response(
                409,
                {
                    "error": f"Cannot delete section '{result['section_name']}' because it contains {result['drink_count']} drink(s). Move or delete the drinks first.",
                    "drink_count": result["drink_count"],
                    "section_name": result["section_name"],
                },
                origin,
            )

        logger.info("Deleted section", extra={"section_id": section_id})

        # Flush API Gateway cache to ensure deleted section is removed
        flush_api_cache()

        return response(
            200, {"data": {"message": "Section deleted successfully"}}, origin
        )

    except Exception as e:
        logger.exception("Failed to delete section")
        return response(500, {"error": "Internal server error"}, origin)
