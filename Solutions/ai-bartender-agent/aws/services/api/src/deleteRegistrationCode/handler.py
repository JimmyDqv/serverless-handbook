"""DELETE /admin/registration-codes/{code} - Delete a registration code."""

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


@tracer.capture_method
def delete_registration_code(code: str) -> bool:
    """Delete a registration code. Returns True if deleted, False if not found."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM cocktails.registration_codes
                WHERE code = %s
                RETURNING code
                """,
                [code],
            )
            deleted = cur.fetchone()
            conn.commit()

            if deleted:
                logger.info("Deleted registration code", extra={"code": code})
                return True
            else:
                logger.warning(
                    "Registration code not found for deletion", extra={"code": code}
                )
                return False


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Handle admin registration code deletion."""
    try:
        path_params = event.get("pathParameters") or {}
        code = path_params.get("code")

        if not code:
            return response(
                400,
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "Missing code parameter",
                    },
                },
            )

        deleted = delete_registration_code(code)

        if not deleted:
            return response(
                404,
                {
                    "success": False,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Registration code not found",
                    },
                },
            )

        return response(200, {"success": True, "message": "Registration code deleted"})

    except Exception as e:
        logger.exception("Failed to delete registration code")
        return response(
            500,
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to delete registration code",
                },
            },
        )
