"""PUT /admin/drinks/{id} - Update an existing drink."""

import json
import os
import sys
from contextlib import contextmanager
from datetime import datetime

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


def validate_recipe(recipe_data):
    """Validate and normalize recipe JSON structure. Returns JSON string or None."""
    if not recipe_data or recipe_data == "":
        return None

    try:
        recipe = json.loads(recipe_data) if isinstance(recipe_data, str) else recipe_data
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in recipe: {e}")

    if not isinstance(recipe, dict):
        raise ValueError("Recipe must be a JSON object")

    if "ingredients" in recipe:
        if not isinstance(recipe["ingredients"], list):
            raise ValueError("Recipe ingredients must be an array")
        for idx, ing in enumerate(recipe["ingredients"]):
            if not isinstance(ing, dict):
                raise ValueError(f"Ingredient {idx} must be an object")
            missing = {"name", "amount"} - set(ing.keys())
            if missing:
                raise ValueError(f"Ingredient {idx} missing: {missing}")
            if "optional" in ing and not isinstance(ing["optional"], bool):
                raise ValueError(f"Ingredient {idx} 'optional' must be boolean")

    if "steps" in recipe:
        if not isinstance(recipe["steps"], list):
            raise ValueError("Recipe steps must be an array")
        for idx, step in enumerate(recipe["steps"]):
            if not isinstance(step, dict):
                raise ValueError(f"Step {idx} must be an object")
            missing = {"order", "instruction"} - set(step.keys())
            if missing:
                raise ValueError(f"Step {idx} missing: {missing}")
            if not isinstance(step["order"], int):
                raise ValueError(f"Step {idx} 'order' must be a number")

    if "preparation_time" in recipe and not isinstance(recipe["preparation_time"], (int, float)):
        raise ValueError("preparation_time must be a number")

    return json.dumps(recipe)


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
            "Access-Control-Allow-Methods": "PUT,OPTIONS",
        },
        "body": json.dumps(body),
    }


@tracer.capture_method
def update_drink_in_db(drink_id: str, updates: dict):
    """Update drink in database. Returns (row, error, old_image_url)."""
    now = datetime.utcnow()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, section_id, name, description,
                       ingredients, recipe, image_url, is_active
                FROM cocktails.drinks WHERE id = %s
                """,
                [drink_id],
            )
            existing = cur.fetchone()

            if not existing:
                return None, "drink_not_found", None

            old_image_url = existing["image_url"]

            section_id = updates.get("section_id", existing["section_id"])
            name = updates.get("name", existing["name"])
            description = updates.get("description", existing["description"])
            ingredients = updates.get("ingredients", existing["ingredients"])
            recipe = updates.get("recipe", existing["recipe"])
            image_url = updates.get("image_url", existing["image_url"])
            is_active = updates.get("is_active", existing["is_active"])

            # Detect image change for cleanup
            image_changed = False
            if "image_url" in updates:
                new_url = updates.get("image_url") or ""
                old_url = old_image_url or ""
                if new_url != old_url:
                    image_changed = True
                    logger.info(f"Image URL changed for drink_id={drink_id}", extra={"old_url": old_url, "new_url": new_url})

            if section_id != existing["section_id"]:
                cur.execute("SELECT id FROM cocktails.sections WHERE id = %s", [section_id])
                if not cur.fetchone():
                    return None, "section_not_found", None

            if isinstance(ingredients, list):
                ingredients = json.dumps(ingredients)

            cur.execute(
                """
                UPDATE cocktails.drinks
                SET section_id = %s, name = %s, description = %s,
                    ingredients = %s, recipe = %s,
                    image_url = %s, is_active = %s, updated_at = %s
                WHERE id = %s
                RETURNING id, section_id, name, description,
                          ingredients, recipe, image_url, is_active, created_at
                """,
                [section_id, name, description, ingredients, recipe, image_url, is_active, now, drink_id],
            )
            row = cur.fetchone()
            conn.commit()

            return row, None, old_image_url if (image_changed and old_image_url) else None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
        drink_id = event.get("pathParameters", {}).get("id")
        if not drink_id:
            return response(400, {"error": "Drink ID is required"}, origin)

        raw_body = event.get("body") or "{}"
        if isinstance(raw_body, str):
            body = json.loads(raw_body)
        else:
            body = raw_body

        # Handle double-encoded JSON
        if isinstance(body, str):
            body = json.loads(body)

        if not isinstance(body, dict):
            return response(400, {"error": "Invalid request body format"}, origin)

        if "recipe" in body:
            try:
                body["recipe"] = validate_recipe(body.get("recipe"))
            except ValueError as e:
                return response(400, {"error": f"Invalid recipe: {str(e)}"}, origin)

        if "recipe_sv" in body:
            try:
                body["recipe_sv"] = validate_recipe(body.get("recipe_sv"))
            except ValueError as e:
                return response(400, {"error": f"Invalid recipe_sv: {str(e)}"}, origin)

        row, error, old_image_url = update_drink_in_db(drink_id, body)

        if error == "drink_not_found":
            return response(404, {"error": "Drink not found"}, origin)
        if error == "section_not_found":
            return response(404, {"error": "Section not found"}, origin)

        if old_image_url:
            bucket_name = os.environ.get("IMAGES_BUCKET")
            if bucket_name:
                try:
                    delete_drink_images(drink_id, bucket_name)
                except Exception as e:
                    logger.error(f"Failed to delete old images for drink_id={drink_id}: {e}")

        ing = row["ingredients"]
        if isinstance(ing, str):
            try:
                ing = json.loads(ing)
            except json.JSONDecodeError:
                ing = []

        drink = {
            "id": row["id"],
            "section_id": row["section_id"],
            "name": row["name"],
            "description": row["description"] or "",
            "ingredients": ing,
            "recipe": json.loads(row["recipe"]) if row["recipe"] else None,
            "image_url": row["image_url"] or "",
            "is_active": row["is_active"],
            "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
        }

        logger.info("Updated drink", extra={"drink_id": drink_id})
        flush_api_cache()

        return response(200, {"data": drink}, origin)

    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"}, origin)
    except Exception:
        logger.exception("Failed to update drink")
        return response(500, {"error": "Internal server error"}, origin)
