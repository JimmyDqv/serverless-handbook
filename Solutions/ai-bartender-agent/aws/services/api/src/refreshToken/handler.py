"""POST /auth/refresh - Refresh access token using refresh token."""

import hashlib
import json
import os
import time
from contextlib import contextmanager
from datetime import datetime, timedelta

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
            "role_arn": os.environ.get("DATABASE_WRITER_ROLE", ""),
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


def response(status_code: int, body: dict) -> dict:
    """Generate API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def get_jwt_keys() -> tuple[str, str]:
    """Get JWT signing keys from Secrets Manager."""
    secret_name = os.environ.get("JWT_KEYS_SECRET_NAME", "ai-bartender/jwt-keys")
    region = os.environ.get("AWS_REGION", "eu-west-1")

    client = boto3.client("secretsmanager", region_name=region)

    try:
        response_data = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response_data["SecretString"])
        return secret["private_key"], secret["public_key"]
    except Exception as e:
        logger.error(f"Failed to retrieve JWT keys: {e}")
        raise


def generate_access_token(user_key: str, username: str) -> str:
    """Generate RS256 signed JWT access token (4 hours validity)."""
    import jwt

    private_key, _ = get_jwt_keys()

    now = int(time.time())
    payload = {
        "token_type": "access",
        "username": username,
        "user_key": str(user_key),
        "iat": now,
        "exp": now + (4 * 60 * 60),  # 4 hours
    }

    return jwt.encode(payload, private_key, algorithm="RS256")


@tracer.capture_method
def validate_and_refresh_token(refresh_token: str) -> dict | None:
    """Validate refresh token and generate new access token."""
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

    with get_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    rt.token_id,
                    rt.user_key,
                    rt.expires_at,
                    rt.is_revoked,
                    u.username,
                    u.is_active
                FROM cocktails.refresh_tokens rt
                JOIN cocktails.app_users u ON rt.user_key = u.user_key
                WHERE rt.token_hash = %s
            """

            cur.execute(query, [token_hash])
            token_data = cur.fetchone()

            if not token_data:
                logger.info("Refresh token not found")
                return None

            if token_data["is_revoked"]:
                logger.info(f"Refresh token revoked for user {token_data['username']}")
                return {"error": "revoked", "message": "Refresh token has been revoked"}

            if datetime.utcnow() > token_data["expires_at"].replace(tzinfo=None):
                logger.info(f"Refresh token expired for user {token_data['username']}")
                return {"error": "expired", "message": "Refresh token has expired"}

            if not token_data["is_active"]:
                logger.info(f"User account disabled: {token_data['username']}")
                return {"error": "disabled", "message": "User account is disabled"}

            cur.execute(
                """
                UPDATE cocktails.refresh_tokens 
                SET last_used_at = CURRENT_TIMESTAMP 
                WHERE token_hash = %s
                """,
                [token_hash],
            )

            cur.execute(
                """
                UPDATE cocktails.app_users 
                SET last_login = CURRENT_TIMESTAMP 
                WHERE user_key = %s
                """,
                [token_data["user_key"]],
            )

            conn.commit()

            access_token = generate_access_token(
                str(token_data["user_key"]), token_data["username"]
            )

            access_token_expires_at = datetime.utcnow() + timedelta(hours=4)

            logger.info(f"Access token refreshed for user: {token_data['username']}")

            return {
                "access_token": access_token,
                "access_token_expires_at": access_token_expires_at.isoformat() + "Z",
            }


@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """Handle token refresh. No authorizer - token validation done here."""
    logger.info("Token refresh request received")

    try:
        # Parse request body
        try:
            body = json.loads(event.get("body", "{}"))
        except json.JSONDecodeError:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "Invalid JSON in request body",
                    },
                },
            )

        refresh_token = body.get("refresh_token", "").strip()

        if not refresh_token:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "MISSING_TOKEN",
                        "message": "Refresh token is required",
                    },
                },
            )

        # Validate and refresh
        result = validate_and_refresh_token(refresh_token)

        if not result:
            return response(
                401,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": "Invalid refresh token",
                    },
                },
            )

        # Check for error responses
        if "error" in result:
            if result["error"] == "revoked":
                return response(
                    403,
                    {
                        "success": False,
                        "error": {
                            "code": "TOKEN_REVOKED",
                            "message": result["message"],
                        },
                    },
                )
            elif result["error"] == "expired":
                return response(
                    401,
                    {
                        "success": False,
                        "error": {
                            "code": "TOKEN_EXPIRED",
                            "message": result["message"],
                        },
                    },
                )
            elif result["error"] == "disabled":
                return response(
                    403,
                    {
                        "success": False,
                        "error": {
                            "code": "ACCOUNT_DISABLED",
                            "message": result["message"],
                        },
                    },
                )

        # Success - return new access token
        return response(
            200,
            {
                "success": True,
                "data": {
                    "access_token": result["access_token"],
                    "access_token_expires_at": result["access_token_expires_at"],
                },
            },
        )

    except Exception as e:
        logger.exception("Unexpected error during token refresh")
        return response(
            500,
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Token refresh failed due to server error",
                },
            },
        )
