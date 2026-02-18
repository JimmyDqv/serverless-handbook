"""API Gateway cache utilities for cache invalidation."""

import os
import boto3
from aws_lambda_powertools import Logger

logger = Logger()

STAGE_NAME = os.environ.get("API_STAGE_NAME", "v1")
API_NAME = os.environ.get("API_NAME", "ai-bartender-api")

_cached_api_id = None


def _discover_api_id() -> str | None:
    """Discover the API Gateway ID by listing APIs and matching by name."""
    global _cached_api_id
    if _cached_api_id:
        return _cached_api_id

    try:
        client = boto3.client("apigateway")
        paginator = client.get_paginator("get_rest_apis")

        for page in paginator.paginate():
            for api in page.get("items", []):
                if api.get("name") == API_NAME:
                    _cached_api_id = api["id"]
                    logger.info(
                        "Discovered API Gateway ID",
                        extra={"api_id": _cached_api_id, "api_name": API_NAME}
                    )
                    return _cached_api_id

        logger.warning(
            "Could not find API Gateway by name",
            extra={"api_name": API_NAME}
        )
        return None
    except Exception as e:
        logger.warning(
            f"Failed to discover API ID: {e}",
            extra={"api_name": API_NAME, "error": str(e)}
        )
        return None


def flush_api_cache() -> bool:
    """Flush the API Gateway stage cache so users see fresh data."""
    api_id = _discover_api_id()
    if not api_id:
        logger.warning("Could not discover API_GATEWAY_ID, skipping cache flush")
        return False

    try:
        client = boto3.client("apigateway")
        client.flush_stage_cache(
            restApiId=api_id,
            stageName=STAGE_NAME
        )
        logger.info(
            "API Gateway cache flushed",
            extra={"api_id": api_id, "stage": STAGE_NAME}
        )
        return True
    except client.exceptions.NotFoundException:
        logger.warning(
            "Cache cluster not found (caching may be disabled)",
            extra={"api_id": api_id, "stage": STAGE_NAME}
        )
        return False
    except Exception as e:
        logger.warning(
            f"Failed to flush cache: {e}",
            extra={"api_id": api_id, "stage": STAGE_NAME, "error": str(e)}
        )
        return False
