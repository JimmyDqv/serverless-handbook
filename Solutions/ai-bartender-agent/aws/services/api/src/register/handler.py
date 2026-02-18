"""POST /register - User registration endpoint."""

import hashlib
import json
import os
import re
import secrets
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


def validate_username(username: str) -> tuple[bool, str | None]:
    """Validate username format. Returns (is_valid, error_message)."""
    if not username or not isinstance(username, str):
        return False, "Username is required"

    username = username.strip()

    if len(username) < 3:
        return False, "Username must be at least 3 characters"

    if len(username) > 100:
        return False, "Username must not exceed 100 characters"

    # Allow letters, numbers, spaces, hyphens, underscores
    if not re.match(r"^[a-zA-ZåäöÅÄÖ0-9 _-]+$", username):
        return False, "Username contains invalid characters"

    return True, None


def get_jwt_keys() -> tuple[str, str]:
    """Get JWT signing keys from Secrets Manager."""
    secret_name = os.environ.get("JWT_KEYS_SECRET_NAME", "ai-bartender/jwt-keys")
    region = os.environ.get("AWS_REGION", "eu-west-1")

    client = boto3.client("secretsmanager", region_name=region)

    try:
        response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response["SecretString"])
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


def generate_refresh_token() -> tuple[str, str]:
    """Generate random refresh token and its SHA-256 hash."""
    token = secrets.token_urlsafe(32)  # 256-bit random token
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


def get_request_metadata(event: dict) -> dict:
    """Extract request metadata for device_info."""
    request_context = event.get("requestContext", {})
    headers = event.get("headers", {})

    return {
        "ip": request_context.get("http", {}).get("sourceIp", "unknown"),
        "user_agent": headers.get("user-agent", "unknown"),
        "timestamp": datetime.utcnow().isoformat(),
    }


@tracer.capture_method
def register_user(registration_code: str, username: str, device_info: dict) -> dict | None:
    """Register a new user in a database transaction. Returns user data or None."""
    with get_connection() as conn:
        try:
            with conn.cursor() as cur:
                # Check if username already exists
                cur.execute(
                    "SELECT user_key FROM cocktails.app_users WHERE username = %s",
                    [username],
                )
                if cur.fetchone():
                    logger.info(f"Username already exists: {username}")
                    return None

                # DSQL: psycopg2 auto-starts a transaction on first query
                # We're already in a transaction from the SELECT above

                # Create user
                cur.execute(
                    """
                    INSERT INTO cocktails.app_users (username, last_login)
                    VALUES (%s, CURRENT_TIMESTAMP)
                    RETURNING user_key, username, created_at
                    """,
                    [username],
                )
                user_data = cur.fetchone()

                if not user_data:
                    conn.rollback()
                    return None

                user_key = user_data["user_key"]

                # Increment use_count for registration code
                # Also set is_used = true if use_count reaches max_uses (for backwards compatibility)
                cur.execute(
                    """
                    UPDATE cocktails.registration_codes
                    SET use_count = COALESCE(use_count, 0) + 1,
                        used_at = CURRENT_TIMESTAMP,
                        used_by_user_key = %s,
                        is_used = CASE
                            WHEN COALESCE(use_count, 0) + 1 >= COALESCE(max_uses, 1) THEN true
                            ELSE is_used
                        END
                    WHERE code = %s
                      AND COALESCE(use_count, CASE WHEN is_used THEN 1 ELSE 0 END) < COALESCE(max_uses, 1)
                    """,
                    [user_key, registration_code],
                )

                if cur.rowcount == 0:
                    logger.error(
                        f"Failed to increment registration code use_count: {registration_code}"
                    )
                    conn.rollback()
                    return None

                # Generate and store refresh token
                refresh_token, token_hash = generate_refresh_token()
                expires_at = datetime.utcnow() + timedelta(days=7)

                cur.execute(
                    """
                    INSERT INTO cocktails.refresh_tokens
                    (user_key, token_hash, expires_at, device_info)
                    VALUES (%s, %s, %s, %s)
                    RETURNING token_id
                    """,
                    [user_key, token_hash, expires_at, json.dumps(device_info)],
                )

                token_data = cur.fetchone()
                if not token_data:
                    conn.rollback()
                    return None

                # Commit transaction
                conn.commit()

                logger.info(f"User registered successfully: {username} ({user_key})")

                return {
                    "user_key": str(user_key),
                    "username": user_data["username"],
                    "refresh_token": refresh_token,
                    "refresh_token_expires_at": expires_at.isoformat() + "Z",
                }

        except Exception as e:
            logger.error(f"Registration error: {e}")
            try:
                conn.rollback()
            except Exception:
                pass  # Connection may already be in error state
            return None


@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Handle user registration.

    Registration code is pre-validated by RegistrationAuthorizer.
    """
    logger.info("Registration request received")

    try:
        # Get registration code from authorizer context
        authorizer = event.get("requestContext", {}).get("authorizer", {})
        registration_code = authorizer.get("registration_code")

        if not registration_code:
            logger.error("Missing registration code from authorizer context")
            return response(
                401,
                {
                    "success": False,
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Invalid registration code",
                    },
                },
            )

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

        username = body.get("username", "").strip()

        # Validate username
        is_valid, error_msg = validate_username(username)
        if not is_valid:
            return response(
                400,
                {
                    "success": False,
                    "error": {"code": "INVALID_USERNAME", "message": error_msg},
                },
            )

        # Get request metadata
        device_info = get_request_metadata(event)

        # Register user
        user_data = register_user(registration_code, username, device_info)

        if not user_data:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "REGISTRATION_FAILED",
                        "message": "Username may already exist or registration code invalid",
                    },
                },
            )

        # Generate access token
        access_token = generate_access_token(
            user_data["user_key"], user_data["username"]
        )

        # Calculate token expiry
        access_token_expires_at = datetime.utcnow() + timedelta(hours=4)

        return response(
            201,
            {
                "success": True,
                "data": {
                    "user_key": user_data["user_key"],
                    "username": user_data["username"],
                    "access_token": access_token,
                    "refresh_token": user_data["refresh_token"],
                    "access_token_expires_at": access_token_expires_at.isoformat()
                    + "Z",
                    "refresh_token_expires_at": user_data["refresh_token_expires_at"],
                },
            },
        )

    except Exception as e:
        logger.exception("Unexpected error during registration")
        return response(
            500,
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Registration failed due to server error",
                },
            },
        )
