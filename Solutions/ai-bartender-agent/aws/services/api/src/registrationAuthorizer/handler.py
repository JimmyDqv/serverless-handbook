"""Registration Code Lambda Authorizer."""

import os
from contextlib import contextmanager
from datetime import datetime

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
def get_db_connection():
    """Get database connection with IAM authentication."""
    config = get_db_config()
    auth_token = get_auth_token(
        config["endpoint"], config["region"], config["role_arn"]
    )

    conn = psycopg2.connect(
        host=config["endpoint"],
        port=5432,
        database="postgres",
        user=config["user"],
        password=auth_token,
        sslmode="require",
        cursor_factory=RealDictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()


@tracer.capture_method
def extract_registration_code(event: dict) -> str:
    """Extract registration code from X-Registration-Code header."""
    headers = event.get("headers", {})
    code = headers.get("x-registration-code") or headers.get("X-Registration-Code")

    if not code:
        raise ValueError("Missing X-Registration-Code header")

    logger.info("Extracted registration code", extra={"code_prefix": code[:8]})
    return code


@tracer.capture_method
def validate_code(code: str) -> dict | None:
    """Validate registration code against database. Returns code data if valid."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT code, created_by, expires_at, is_used, used_at,
                       COALESCE(max_uses, 1) as max_uses,
                       COALESCE(use_count, CASE WHEN is_used THEN 1 ELSE 0 END) as use_count
                FROM cocktails.registration_codes
                WHERE code = %s
                """,
                (code,),
            )
            result = cur.fetchone()

            if not result:
                logger.warning("Registration code not found", extra={"code": code})
                return None

            if result["use_count"] >= result["max_uses"]:
                logger.warning(
                    "Registration code fully used",
                    extra={"code": code, "use_count": result["use_count"], "max_uses": result["max_uses"]},
                )
                return None

            if datetime.now() > result["expires_at"]:
                logger.warning("Registration code expired", extra={"code": code})
                return None

            logger.info(
                "Registration code validated",
                extra={"code": code, "use_count": result["use_count"], "max_uses": result["max_uses"]},
            )
            return result


def generate_policy(principal_id: str, effect: str, resource: str, context: dict = None) -> dict:
    """Generate IAM policy for API Gateway."""
    policy = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
    }
    if context:
        policy["context"] = context
    return policy


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """Validate registration code and return Allow/Deny policy."""
    method_arn = event.get("methodArn", "")
    logger.info("Registration authorizer invoked", extra={"method_arn": method_arn})

    try:
        registration_code = extract_registration_code(event)
        code_data = validate_code(registration_code)

        if not code_data:
            return generate_policy("user", "Deny", method_arn)

        logger.info("Authorization successful", extra={"code": registration_code})
        return generate_policy(
            registration_code,
            "Allow",
            method_arn,
            context={
                "registration_code": registration_code,
                "created_by": code_data["created_by"],
            },
        )

    except ValueError as e:
        logger.warning("Validation error", extra={"error": str(e)})
        return generate_policy("user", "Deny", method_arn)
    except Exception as e:
        logger.exception("Authorization error")
        return generate_policy("user", "Deny", method_arn)
