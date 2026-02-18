"""POST /admin/drinks - Create a new drink."""

import json
import os
import sys
import uuid
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

EVENT_BUS_NAME = os.environ.get("DRINK_EVENT_BUS_NAME", "")


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


@tracer.capture_method
def publish_drink_created(drink: dict) -> bool:
    """Publish DrinkCreated event to EventBridge. Fire-and-forget."""
    if not EVENT_BUS_NAME:
        logger.warning("DRINK_EVENT_BUS_NAME not configured, skipping event publish")
        return False

    try:
        events_client = boto3.client("events")

        event_detail = {
            "metadata": {
                "event_type": "DRINK_CREATED",
                "version": "1.0",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "correlation_id": drink["id"],
            },
            "data": {
                "drink_id": drink["id"],
                "name": drink["name"],
                "description": drink.get("description", ""),
                "ingredients": drink.get("ingredients", []),
            },
        }

        resp = events_client.put_events(
            Entries=[
                {
                    "Source": "ai-bartender.api",
                    "DetailType": "DrinkCreated",
                    "Detail": json.dumps(event_detail),
                    "EventBusName": EVENT_BUS_NAME,
                }
            ]
        )

        if resp.get("FailedEntryCount", 0) > 0:
            logger.error("Failed to publish DrinkCreated event", extra={"failed_entries": resp.get("Entries")})
            return False

        logger.info("Published DrinkCreated event", extra={"drink_id": drink["id"]})
        return True

    except Exception:
        logger.exception("Error publishing DrinkCreated event")
        return False


def response(status_code: int, body: dict, origin: str = "*") -> dict:
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
def create_drink_in_db(drink_data: dict):
    """Insert drink into database. Returns (row, error)."""
    drink_id = str(uuid.uuid4())
    now = datetime.utcnow()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM cocktails.sections WHERE id = %s",
                [drink_data["section_id"]],
            )
            if not cur.fetchone():
                return None, "section_not_found"

            cur.execute(
                """
                INSERT INTO cocktails.drinks
                (id, section_id, name, description, ingredients, recipe, image_url, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, section_id, name, description, ingredients, recipe, image_url, is_active, created_at
                """,
                [
                    drink_id,
                    drink_data["section_id"],
                    drink_data["name"],
                    drink_data["description"],
                    json.dumps(drink_data["ingredients"]),
                    drink_data["recipe"],
                    drink_data["image_url"],
                    drink_data["is_active"],
                    now,
                    now,
                ],
            )
            row = cur.fetchone()
            conn.commit()
            return row, None


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or "*"

    try:
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

        name = body.get("name")
        section_id = body.get("section_id")
        if not name:
            return response(400, {"error": "name is required"}, origin)
        if not section_id:
            return response(400, {"error": "section_id is required"}, origin)

        try:
            validated_recipe = validate_recipe(body.get("recipe", ""))
        except ValueError as e:
            return response(400, {"error": f"Invalid recipe: {str(e)}"}, origin)

        drink_data = {
            "name": name,
            "section_id": section_id,
            "description": body.get("description", ""),
            "ingredients": body.get("ingredients", []),
            "recipe": validated_recipe,
            "image_url": body.get("image_url", ""),
            "is_active": body.get("is_active", True),
        }

        row, error = create_drink_in_db(drink_data)

        if error == "section_not_found":
            return response(404, {"error": "Section not found"}, origin)

        drink = {
            "id": row["id"],
            "section_id": row["section_id"],
            "name": row["name"],
            "description": row["description"] or "",
            "ingredients": (
                json.loads(row["ingredients"])
                if isinstance(row["ingredients"], str)
                else row["ingredients"]
            ),
            "recipe": json.loads(row["recipe"]) if row["recipe"] else None,
            "image_url": row["image_url"] or "",
            "is_active": row["is_active"],
            "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
        }

        logger.info("Created drink", extra={"drink_id": row["id"], "drink_name": name})
        flush_api_cache()
        publish_drink_created(drink)

        return response(201, {"data": drink}, origin)

    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON body"}, origin)
    except Exception:
        logger.exception("Failed to create drink")
        return response(500, {"error": "Internal server error"}, origin)
