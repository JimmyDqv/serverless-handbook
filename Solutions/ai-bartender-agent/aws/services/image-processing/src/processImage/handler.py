"""S3 Trigger - Process uploaded images and generate optimized versions."""

import json
import os
import io
import time
from contextlib import contextmanager

import boto3
import psycopg2
from psycopg2.extras import RealDictCursor
from PIL import Image
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()

IMAGE_SIZES = {
    "thumbnail": (150, 150),
    "small": (400, 400),
    "medium": (800, 800),
    "large": (1200, 1200),
}

WEBP_QUALITY = 85

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


@tracer.capture_method
def download_image_from_s3(bucket: str, key: str) -> bytes:
    """Download image from S3."""
    s3_client = boto3.client("s3")
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


@tracer.capture_method
def upload_image_to_s3(
    bucket: str, key: str, image_bytes: bytes, content_type: str = "image/webp"
):
    """Upload processed image to S3."""
    s3_client = boto3.client("s3")
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=image_bytes,
        ContentType=content_type,
        CacheControl="public, max-age=31536000",
    )


@tracer.capture_method
def resize_and_convert_image(
    image_data: bytes, target_size: tuple[int, int], quality: int = WEBP_QUALITY
) -> bytes:
    """Resize image and convert to WebP format."""
    img = Image.open(io.BytesIO(image_data))

    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(
            img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None
        )
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    img.thumbnail(target_size, Image.Resampling.LANCZOS)

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=quality, method=6)
    return output.getvalue()


@tracer.capture_method
def update_drink_image_url(drink_id: str, image_url: str, max_retries: int = 3, retry_delay: float = 2.0) -> None:
    """Update drink record with image URL. Retries if drink not yet visible."""
    for attempt in range(1, max_retries + 1):
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM cocktails.drinks WHERE id = %s",
                    [drink_id],
                )
                if not cur.fetchone():
                    if attempt < max_retries:
                        logger.warning(
                            "Drink not found, retrying",
                            extra={"drink_id": drink_id, "attempt": attempt, "max_retries": max_retries},
                        )
                        time.sleep(retry_delay * attempt)
                        continue
                    raise ValueError(f"Drink {drink_id} not found after {max_retries} attempts")

                cur.execute(
                    """
                    UPDATE cocktails.drinks
                    SET image_url = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    [image_url, drink_id],
                )
                conn.commit()
                logger.info("Updated drink image URL", extra={"drink_id": drink_id, "attempt": attempt})
                return


@tracer.capture_method
def process_image(bucket: str, key: str) -> dict[str, str]:
    """Process uploaded image and generate all size variants."""
    parts = key.split("/")
    if len(parts) < 3 or parts[0] != "original":
        raise ValueError(
            f"Invalid key format: {key}. Expected: original/{{drink_id}}/{{filename}}"
        )

    drink_id = parts[1]
    original_image = download_image_from_s3(bucket, key)

    img = Image.open(io.BytesIO(original_image))
    width, height = img.size
    if width < 400 or height < 400:
        raise ValueError(f"Image too small: {width}x{height}. Minimum: 400x400")

    generated_urls = {}
    cloudfront_domain = os.environ.get("CLOUDFRONT_DOMAIN", "")

    for size_name, dimensions in IMAGE_SIZES.items():
        webp_image = resize_and_convert_image(original_image, dimensions)
        output_key = f"images/optimized/{size_name}/{drink_id}.webp"
        upload_image_to_s3(bucket, output_key, webp_image)

        if cloudfront_domain:
            generated_urls[size_name] = f"https://{cloudfront_domain}/{output_key}"
        else:
            generated_urls[size_name] = (
                f"https://{bucket}.s3.amazonaws.com/{output_key}"
            )

    image_url = generated_urls.get("medium", "")
    if image_url:
        update_drink_image_url(drink_id, image_url)

    logger.info("Image processing complete", extra={"drink_id": drink_id, "sizes": len(generated_urls)})
    return generated_urls


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    """EventBridge trigger handler for S3 image uploads."""
    logger.info("Processing event", extra={"event": event})

    try:
        detail = event.get("detail", {})
        bucket = detail.get("bucket", {}).get("name")
        key = detail.get("object", {}).get("key")

        if not bucket or not key:
            raise ValueError("Invalid EventBridge event: missing bucket or key")

        if not key.startswith("original/"):
            return {
                "statusCode": 200,
                "body": json.dumps({"message": "Skipped - not in original/ prefix"}),
            }

        generated_urls = process_image(bucket, key)

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Success", "urls": generated_urls}),
        }

    except Exception as e:
        logger.exception("Failed to process image")
        raise
