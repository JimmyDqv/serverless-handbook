"""API Gateway cache utilities for cache invalidation."""

import os
import boto3
from aws_lambda_powertools import Logger

logger = Logger()

API_ID = os.environ.get("API_GATEWAY_ID")
STAGE_NAME = os.environ.get("API_STAGE_NAME", "v1")


def flush_api_cache() -> bool:
    """
    Flush the entire API Gateway cache for the stage.

    Call this after admin operations that modify drinks or sections
    to ensure users see fresh data.

    Returns:
        bool: True if cache was flushed successfully, False otherwise
    """
    if not API_ID:
        logger.warning("API_GATEWAY_ID not configured, skipping cache flush")
        return False

    try:
        client = boto3.client("apigateway")
        client.flush_stage_cache(
            restApiId=API_ID,
            stageName=STAGE_NAME
        )
        logger.info(
            "API Gateway cache flushed",
            extra={"api_id": API_ID, "stage": STAGE_NAME}
        )
        return True
    except client.exceptions.NotFoundException:
        logger.warning(
            "Cache cluster not found (caching may be disabled)",
            extra={"api_id": API_ID, "stage": STAGE_NAME}
        )
        return False
    except Exception as e:
        logger.warning(
            f"Failed to flush cache: {e}",
            extra={"api_id": API_ID, "stage": STAGE_NAME, "error": str(e)}
        )
        return False
