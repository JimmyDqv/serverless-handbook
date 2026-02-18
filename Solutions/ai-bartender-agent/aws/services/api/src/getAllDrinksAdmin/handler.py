"""GET /admin/drinks - Get all drinks including inactive (admin view)."""

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


def parse_ingredients(ingredients):
    if isinstance(ingredients, str):
        try:
            return json.loads(ingredients)
        except json.JSONDecodeError:
            return []
    return ingredients if isinstance(ingredients, list) else []


@tracer.capture_method
def get_all_drinks_from_db(section_id: str = None, include_inactive: bool = True):
    with get_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT d.id, d.section_id, d.name, d.description,
                       d.ingredients, d.recipe, d.image_url, d.is_active,
                       d.created_at, d.updated_at, s.name as section_name
                FROM cocktails.drinks d
                JOIN cocktails.sections s ON d.section_id = s.id
                WHERE 1=1
            """
            params_list = []

            if section_id:
                query += " AND d.section_id = %s"
                params_list.append(section_id)

            if not include_inactive:
                query += " AND d.is_active = true"

            query += " ORDER BY s.display_order, d.name"

            cur.execute(query, params_list)
            return cur.fetchall()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """GET /admin/drinks handler - returns ALL drinks including inactive."""
    # Get origin for CORS (required when using Authorization header)
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        params = event.get("queryStringParameters") or {}
        section_id = params.get("section_id")
        include_inactive = params.get("include_inactive", "true").lower() == "true"

        rows = get_all_drinks_from_db(section_id, include_inactive)

        drinks = [
            {
                "id": row["id"],
                "section_id": row["section_id"],
                "section_name": row["section_name"],
                "name": row["name"],
                "description": row["description"] or "",
                "ingredients": parse_ingredients(row["ingredients"]),
                "recipe": json.loads(row["recipe"]) if row["recipe"] else None,
                "image_url": row["image_url"] or "",
                "is_active": row["is_active"],
                "created_at": (
                    row["created_at"].isoformat() + "Z" if row["created_at"] else None
                ),
                "updated_at": (
                    row["updated_at"].isoformat() + "Z" if row["updated_at"] else None
                ),
            }
            for row in rows
        ]

        logger.info(
            "Retrieved drinks (admin)",
            extra={"count": len(drinks), "include_inactive": include_inactive},
        )
        return response(200, {"data": drinks}, origin)

    except Exception as e:
        logger.exception("Failed to get drinks")
        return response(500, {"error": "Internal server error"}, origin)
