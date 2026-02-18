"""MCP tool handler for AgentCore Gateway — provides drink-related tools."""

import json
import os
import time
from contextlib import contextmanager

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

STS_REFRESH_BUFFER_SECONDS = 300
DSQL_TOKEN_VALIDITY_SECONDS = 900
DSQL_TOKEN_REFRESH_BUFFER_SECONDS = 60
DSQL_PORT = 5432
DSQL_DATABASE = "postgres"
DSQL_SSL_MODE = "require"
DEFAULT_REGION = "eu-west-1"

tracer = Tracer()
logger = Logger()

_db_config: dict | None = None
_sts_cache: dict = {"credentials": None, "expires_at": 0}
_auth_token_cache: dict = {"token": None, "expires_at": 0}


def get_db_config() -> dict[str, str]:
    """Get database configuration from environment variables."""
    global _db_config
    if _db_config is None:
        _db_config = {
            "endpoint": os.environ.get("DSQL_CLUSTER_ENDPOINT", ""),
            "region": os.environ.get("AWS_REGION", DEFAULT_REGION),
            "role_arn": os.environ.get("DATABASE_READER_ROLE", ""),
            "user": os.environ.get("DATABASE_USER", "admin"),
        }
    return _db_config


@tracer.capture_method
def get_sts_credentials(role_arn: str, region: str) -> dict:
    """Get cached STS credentials, refreshing before expiry."""
    global _sts_cache
    now = time.time()

    if _sts_cache["credentials"] and _sts_cache["expires_at"] > now + STS_REFRESH_BUFFER_SECONDS:
        logger.debug("Using cached STS credentials")
        return _sts_cache["credentials"]

    logger.info("Refreshing STS credentials")
    sts = boto3.client("sts", region_name=region)
    response = sts.assume_role(RoleArn=role_arn, RoleSessionName="dsql-session")
    creds = response["Credentials"]

    _sts_cache["credentials"] = creds
    _sts_cache["expires_at"] = creds["Expiration"].timestamp()

    return creds


@tracer.capture_method
def get_auth_token(endpoint: str, region: str, role_arn: str) -> str:
    """Get cached DSQL auth token, refreshing before expiry."""
    global _auth_token_cache
    now = time.time()

    if _auth_token_cache["token"] and _auth_token_cache["expires_at"] > now + DSQL_TOKEN_REFRESH_BUFFER_SECONDS:
        logger.debug("Using cached DSQL auth token")
        return _auth_token_cache["token"]

    logger.info("Refreshing DSQL auth token")
    if role_arn:
        creds = get_sts_credentials(role_arn, region)
        dsql = boto3.client(
            "dsql",
            region_name=region,
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )
    else:
        dsql = boto3.client("dsql", region_name=region)

    token = dsql.generate_db_connect_auth_token(Hostname=endpoint, Region=region)

    _auth_token_cache["token"] = token
    _auth_token_cache["expires_at"] = now + DSQL_TOKEN_VALIDITY_SECONDS

    return token


@contextmanager
def get_connection():
    """Create a database connection with DSQL IAM authentication."""
    config = get_db_config()
    token = get_auth_token(config["endpoint"], config["region"], config["role_arn"])
    conn = psycopg2.connect(
        host=config["endpoint"],
        port=DSQL_PORT,
        database=DSQL_DATABASE,
        user=config["user"],
        password=token,
        sslmode=DSQL_SSL_MODE,
        cursor_factory=RealDictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()


def parse_ingredients(ingredients) -> list:
    """Parse ingredients from JSON string or return as-is if already a list."""
    if isinstance(ingredients, str):
        try:
            return json.loads(ingredients)
        except json.JSONDecodeError:
            return []
    return ingredients if isinstance(ingredients, list) else []


@tracer.capture_method
def get_drinks_from_db(section_id: str = None) -> list:
    """Fetch drinks from the database, optionally filtered by section."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if section_id:
                cur.execute(
                    """
                    SELECT id, section_id, name, description,
                           ingredients, image_url
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
                           ingredients, image_url
                    FROM cocktails.drinks
                    WHERE is_active = true
                    ORDER BY name
                    """
                )
            return cur.fetchall()


@tracer.capture_method
def handle_get_drinks(tool_input: dict) -> dict:
    """Handle the getDrinks tool invocation."""
    section_id = tool_input.get("section_id")

    rows = get_drinks_from_db(section_id)

    # Compact format: name + ingredients only
    # The model knows what classic drinks are, no need for descriptions
    drinks = [
        {
            "name": row["name"],
            "ingredients": ", ".join(parse_ingredients(row["ingredients"])),
        }
        for row in rows
    ]

    logger.info(
        "getDrinks tool executed",
        extra={"count": len(drinks), "section_id": section_id},
    )

    return {"drinks": drinks, "count": len(drinks)}


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Lambda handler for MCP tool invocations from AgentCore Gateway."""
    logger.info("MCP tool invocation received", extra={"event": event})

    try:
        result = handle_get_drinks(event)

        logger.info("Tool executed successfully", extra={"count": result.get("count")})
        return result

    except Exception as e:
        logger.exception("Tool execution failed")
        return {"error": str(e)}
