"""AppSync Events publisher for real-time order updates."""

import json
import os
from typing import Any, Dict, Optional

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials
import urllib.request
import urllib.error

from aws_lambda_powertools import Logger

logger = Logger()

# Event types
EVENT_ORDER_CREATED = "ORDER_CREATED"
EVENT_ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED"
EVENT_ORDER_COMPLETED = "ORDER_COMPLETED"

# Channel patterns
CHANNEL_USER = "/orders/user/{user_key}"  # User-specific channel
CHANNEL_ADMIN = "/orders/admin"  # Admin channel for all orders


def get_events_config() -> Dict[str, str]:
    """Get AppSync Events configuration from environment variables."""
    return {
        "http_endpoint": os.environ.get("APPSYNC_EVENTS_HTTP_ENDPOINT", ""),
        "api_key": os.environ.get("APPSYNC_EVENTS_API_KEY", ""),
    }


def publish_event(
    channel: str,
    event_type: str,
    payload: Dict[str, Any],
) -> bool:
    """
    Publish an event to AppSync Events API.

    Args:
        channel: The channel path (e.g., "/orders/user/abc123" or "/orders/admin")
        event_type: Type of event (ORDER_CREATED, ORDER_STATUS_CHANGED, ORDER_COMPLETED)
        payload: The event payload data

    Returns:
        True if published successfully, False otherwise
    """
    config = get_events_config()

    if not config["http_endpoint"] or not config["api_key"]:
        logger.warning("AppSync Events not configured, skipping event publish")
        return False

    # Construct the full channel path
    # AppSync Events expects the namespace prefix
    full_channel = f"/orders{channel}" if not channel.startswith("/orders") else channel

    # Build the event message
    event_message = {
        "type": event_type,
        "data": payload,
    }

    # AppSync Events HTTP endpoint for publishing
    # Ensure https:// prefix is present (CloudFormation exports just the hostname)
    endpoint = config['http_endpoint']
    if not endpoint.startswith("https://"):
        endpoint = f"https://{endpoint}"
    url = f"{endpoint}/event"

    # Request body format for AppSync Events
    request_body = json.dumps({
        "channel": full_channel,
        "events": [json.dumps(event_message)],
    })

    headers = {
        "Content-Type": "application/json",
        "x-api-key": config["api_key"],
    }

    try:
        req = urllib.request.Request(
            url,
            data=request_body.encode("utf-8"),
            headers=headers,
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            response_body = response.read().decode("utf-8")
            logger.info(
                "Event published successfully",
                extra={
                    "channel": full_channel,
                    "event_type": event_type,
                    "response": response_body,
                },
            )
            return True

    except urllib.error.HTTPError as e:
        logger.error(
            "Failed to publish event",
            extra={
                "channel": full_channel,
                "event_type": event_type,
                "error": str(e),
                "response_body": e.read().decode("utf-8") if e.fp else None,
            },
        )
        return False
    except Exception as e:
        logger.error(
            "Error publishing event",
            extra={
                "channel": full_channel,
                "event_type": event_type,
                "error": str(e),
            },
        )
        return False


def publish_order_created(order: Dict[str, Any], user_key: str) -> None:
    """
    Publish ORDER_CREATED event to both user and admin channels.

    Args:
        order: The order data
        user_key: The user's unique key for their personal channel
    """
    # Publish to user's channel
    user_channel = CHANNEL_USER.format(user_key=user_key)
    publish_event(user_channel, EVENT_ORDER_CREATED, order)

    # Publish to admin channel
    publish_event(CHANNEL_ADMIN, EVENT_ORDER_CREATED, order)


def publish_order_status_changed(
    order: Dict[str, Any],
    user_key: str,
    old_status: Optional[str] = None,
) -> None:
    """
    Publish ORDER_STATUS_CHANGED or ORDER_COMPLETED event.

    Args:
        order: The updated order data
        user_key: The user's unique key for their personal channel
        old_status: The previous status (optional, for logging)
    """
    new_status = order.get("status")

    # Determine event type based on new status
    if new_status == "completed":
        event_type = EVENT_ORDER_COMPLETED
    else:
        event_type = EVENT_ORDER_STATUS_CHANGED

    payload = {
        **order,
        "previous_status": old_status,
    }

    # Publish to user's channel
    user_channel = CHANNEL_USER.format(user_key=user_key)
    publish_event(user_channel, event_type, payload)

    # Publish to admin channel
    publish_event(CHANNEL_ADMIN, event_type, payload)
