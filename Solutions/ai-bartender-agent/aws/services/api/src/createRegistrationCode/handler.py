"""POST /admin/registration-codes - Create a new registration code."""

import json
import os
import uuid
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


def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def get_admin_context(event: dict) -> tuple[str | None, str | None]:
    """Extract admin context from Cognito JWT authorizer."""
    authorizer = event.get("requestContext", {}).get("authorizer", {})

    jwt_claims = authorizer.get("jwt", {}).get("claims", {})
    rest_claims = authorizer.get("claims", {})

    username = (
        jwt_claims.get("cognito:username")
        or jwt_claims.get("username")
        or jwt_claims.get("email")
        or rest_claims.get("cognito:username")
        or rest_claims.get("username")
        or authorizer.get("username")
    )
    email = jwt_claims.get("email") or rest_claims.get("email")

    logger.info(
        "Authorizer context",
        extra={"authorizer": authorizer, "username": username, "email": email},
    )

    return username, email


@tracer.capture_method
def create_registration_code(
    created_by: str,
    expires_in_hours: int = 24,
    notes: str | None = None,
    max_uses: int = 1,
) -> dict:
    """Create a new registration code in the database."""
    code = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cocktails.registration_codes
                (code, created_by, expires_at, notes, max_uses, use_count)
                VALUES (%s, %s, %s, %s, %s, 0)
                RETURNING code, created_at, created_by, expires_at, is_used, notes, max_uses, use_count
                """,
                [code, created_by, expires_at, notes, max_uses],
            )
            row = cur.fetchone()
            conn.commit()

            logger.info(
                "Created registration code",
                extra={
                    "code": code,
                    "created_by": created_by,
                    "expires_at": expires_at.isoformat(),
                    "max_uses": max_uses,
                },
            )

            return row


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle admin registration code creation."""
    try:
        username, email = get_admin_context(event)
        created_by = username or email or "admin"

        raw_body = event.get("body") or "{}"

        try:
            if isinstance(raw_body, str):
                body = json.loads(raw_body)
            else:
                body = raw_body

            if isinstance(body, str):
                body = json.loads(body)

            if not isinstance(body, dict):
                logger.error(
                    "Body is not a dict after parsing",
                    extra={"body_type": type(body).__name__},
                )
                return response(
                    400,
                    {
                        "success": False,
                        "error": {
                            "code": "INVALID_REQUEST",
                            "message": "Invalid request body format",
                        },
                    },
                )
        except json.JSONDecodeError:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "Invalid JSON body",
                    },
                },
            )

        expires_in_hours = body.get("expires_in_hours", 24)
        notes = body.get("notes")
        max_uses = body.get("max_uses", 1)

        if isinstance(expires_in_hours, str):
            try:
                expires_in_hours = int(expires_in_hours)
            except ValueError:
                return response(
                    400,
                    {
                        "success": False,
                        "error": {
                            "code": "INVALID_REQUEST",
                            "message": "expires_in_hours must be a valid number",
                        },
                    },
                )

        if not isinstance(expires_in_hours, int) or expires_in_hours < 1 or expires_in_hours > 168:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "expires_in_hours must be between 1 and 168 (7 days)",
                    },
                },
            )

        if isinstance(max_uses, str):
            try:
                max_uses = int(max_uses)
            except ValueError:
                return response(
                    400,
                    {
                        "success": False,
                        "error": {
                            "code": "INVALID_REQUEST",
                            "message": "max_uses must be a valid number",
                        },
                    },
                )

        if not isinstance(max_uses, int) or max_uses < 1 or max_uses > 25:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "max_uses must be between 1 and 25",
                    },
                },
            )

        row = create_registration_code(
            created_by=created_by,
            expires_in_hours=expires_in_hours,
            notes=notes,
            max_uses=max_uses,
        )

        frontend_url = os.environ.get("FRONTEND_URL", "")
        registration_url = f"{frontend_url}/register?code={row['code']}"

        result = {
            "code": str(row["code"]),
            "created_at": (
                row["created_at"].isoformat() + "Z" if row["created_at"] else None
            ),
            "created_by": row["created_by"],
            "expires_at": (
                row["expires_at"].isoformat() + "Z" if row["expires_at"] else None
            ),
            "is_used": row["is_used"],
            "notes": row["notes"],
            "max_uses": row["max_uses"],
            "use_count": row["use_count"],
            "registration_url": registration_url,
        }

        return response(201, {"success": True, "data": result})

    except Exception as e:
        logger.exception("Failed to create registration code")
        return response(
            500,
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to create registration code",
                },
            },
        )
