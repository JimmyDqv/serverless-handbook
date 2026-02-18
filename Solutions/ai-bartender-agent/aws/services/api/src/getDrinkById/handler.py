"""GET /drinks/{id} - Returns a single drink by ID."""

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


def parse_ingredients(ingredients):
    if isinstance(ingredients, str):
        try:
            return json.loads(ingredients)
        except json.JSONDecodeError:
            return []
    return ingredients if isinstance(ingredients, list) else []


@tracer.capture_method
def get_drink_from_db(drink_id: str):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, section_id, name, description,
                       ingredients, recipe, image_url, is_active, created_at
                FROM cocktails.drinks
                WHERE id = %s
            """,
                [drink_id],
            )
            return cur.fetchone()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    try:
        drink_id = event.get("pathParameters", {}).get("id")
        if not drink_id:
            return response(400, {"error": "Drink ID is required"})

        row = get_drink_from_db(drink_id)

        # Return 404 if drink doesn't exist OR is inactive (hidden from public)
        if not row or not row["is_active"]:
            return response(404, {"error": "Drink not found"})

        drink = {
            "id": row["id"],
            "section_id": row["section_id"],
            "name": row["name"],
            "description": row["description"] or "",
            "ingredients": parse_ingredients(row["ingredients"]),
            "recipe": json.loads(row["recipe"]) if row["recipe"] else None,
            "image_url": row["image_url"] or "",
            "is_active": row["is_active"],
            "created_at": (
                row["created_at"].isoformat() + "Z" if row["created_at"] else None
            ),
        }

        logger.info("Retrieved drink", extra={"drink_id": drink_id})
        return response(200, {"data": drink})

    except Exception as e:
        logger.exception("Failed to get drink")
        return response(500, {"error": "Internal server error"})
