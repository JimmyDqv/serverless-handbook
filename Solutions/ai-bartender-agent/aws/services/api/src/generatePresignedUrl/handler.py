"""POST /admin/images/upload-url - Generate presigned URL for image upload."""

import json
import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()

# Allowed content types for images
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def response(status_code: int, body: dict, origin: str = "*") -> dict:
    """Build API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


@tracer.capture_method
def generate_presigned_url(
    bucket: str, key: str, content_type: str, expires_in: int = 300
) -> str:
    """Generate presigned URL for S3 upload."""
    s3_client = boto3.client(
        "s3", region_name=os.environ.get("AWS_REGION", "eu-west-1")
    )

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )

    return presigned_url


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """Generate presigned URL for image upload."""
    # Get origin for CORS
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        # Parse request body - handle potential double-encoding
        raw_body = event.get("body") or "{}"

        # First parse
        if isinstance(raw_body, str):
            body = json.loads(raw_body)
        else:
            body = raw_body

        # Handle double-encoded JSON (body was stringified twice)
        if isinstance(body, str):
            body = json.loads(body)

        # Final validation - must be a dict
        if not isinstance(body, dict):
            logger.error(
                "Body is not a dict after parsing",
                extra={"body_type": type(body).__name__},
            )
            return response(400, {"error": "Invalid request body format"}, origin)

        # Validate required fields
        drink_id = body.get("drink_id")
        content_type = body.get("content_type")

        if not drink_id:
            return response(400, {"error": "drink_id is required"}, origin)

        if not content_type:
            return response(400, {"error": "content_type is required"}, origin)

        # Validate content type
        if content_type not in ALLOWED_CONTENT_TYPES:
            return response(
                400,
                {
                    "error": f"Invalid content type. Allowed: {', '.join(ALLOWED_CONTENT_TYPES.keys())}"
                },
                origin,
            )

        # Use content type to determine extension
        file_extension = ALLOWED_CONTENT_TYPES[content_type]

        # Get bucket name from environment
        bucket_name = os.environ.get("IMAGES_BUCKET")
        if not bucket_name:
            logger.error("IMAGES_BUCKET environment variable not set")
            return response(500, {"error": "Configuration error"}, origin)

        # Generate S3 key for original image
        image_key = f"original/{drink_id}/image.{file_extension}"

        # Generate presigned URL
        upload_url = generate_presigned_url(
            bucket=bucket_name,
            key=image_key,
            content_type=content_type,
            expires_in=300,  # 5 minutes
        )

        logger.info(
            "Generated presigned URL",
            extra={
                "drink_id": drink_id,
                "content_type": content_type,
                "image_key": image_key,
            },
        )

        return response(
            200,
            {
                "data": {
                    "upload_url": upload_url,
                    "image_key": image_key,
                    "bucket": bucket_name,
                    "expires_in": 300,
                }
            },
            origin,
        )

    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"}, origin)
    except Exception as e:
        logger.exception("Failed to generate presigned URL")
        return response(500, {"error": "Internal server error"}, origin)
