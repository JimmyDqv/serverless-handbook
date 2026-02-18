"""DELETE /admin/drinks/{id} - Delete a drink and its images."""

import json
import os
import sys
from contextlib import contextmanager

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

sys.path.insert(0, "/opt/python")
from shared.cache_utils import flush_api_cache

tracer = Tracer()
logger = Logger()

IMAGE_SIZES = ["thumbnail", "small", "medium", "large"]


@tracer.capture_method
def delete_drink_images(drink_id: str, bucket_name: str) -> bool:
    """Delete all original and optimized images for a drink from S3."""
    if not bucket_name:
        logger.warning("No IMAGES_BUCKET configured, skipping image deletion")
        return False

    s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "eu-west-1"))
    objects_to_delete = []

    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket_name, Prefix=f"original/{drink_id}/"):
            for obj in page.get("Contents", []):
                objects_to_delete.append({"Key": obj["Key"]})

        for size in IMAGE_SIZES:
            objects_to_delete.append({"Key": f"images/optimized/{size}/{drink_id}.webp"})

        if not objects_to_delete:
            return True

        resp = s3_client.delete_objects(
            Bucket=bucket_name,
            Delete={"Objects": objects_to_delete, "Quiet": False},
        )

        errors = resp.get("Errors", [])
        if errors:
            for error in errors:
                logger.error(f"Failed to delete {error['Key']}: {error['Code']} - {error['Message']}")
            return False

        logger.info(f"Deleted {len(resp.get('Deleted', []))} images for drink_id={drink_id}")
        return True

    except Exception as e:
        logger.error(f"Error deleting images for drink_id={drink_id}: {e}")
        return False


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
def delete_drink_from_db(drink_id: str):
    """Delete drink from database. Returns deleted row or None."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM cocktails.drinks WHERE id = %s RETURNING id",
                [drink_id],
            )
            row = cur.fetchone()
            conn.commit()
            return row


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        drink_id = event.get("pathParameters", {}).get("id")
        if not drink_id:
            return response(400, {"error": "Drink ID is required"}, origin)

        row = delete_drink_from_db(drink_id)

        if not row:
            return response(404, {"error": "Drink not found"}, origin)

        bucket_name = os.environ.get("IMAGES_BUCKET")
        if bucket_name:
            try:
                delete_drink_images(drink_id, bucket_name)
            except Exception as e:
                logger.error(f"Failed to delete images for drink_id={drink_id}: {e}")

        logger.info("Deleted drink and images", extra={"drink_id": drink_id})
        flush_api_cache()

        return response(200, {"message": "Drink deleted successfully"}, origin)

    except Exception:
        logger.exception("Failed to delete drink")
        return response(500, {"error": "Internal server error"}, origin)
