import json
import logging
import os

import boto3

logger = logging.getLogger()
_sqs = boto3.client("sqs")


def track_login(guest_id: str) -> None:
    _send(guest_id, "login")


def track_access(guest_id: str) -> None:
    _send(guest_id, "access")


def _send(guest_id: str, event_type: str) -> None:
    try:
        queue_url = os.environ.get("TRACKING_QUEUE_URL", "")
        if not queue_url:
            return
        _sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({"guestId": guest_id, "type": event_type}),
        )
    except Exception:
        logger.warning("Failed to send tracking event", exc_info=True)
