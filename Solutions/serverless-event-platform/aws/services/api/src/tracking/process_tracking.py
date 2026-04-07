import json
import logging
from datetime import datetime, timezone

from lib.mongo import get_db

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> None:
    db = get_db()

    for record in event.get("Records", []):
        try:
            body = json.loads(record["body"])
            guest_id = body["guestId"]
            event_type = body["type"]
            now = datetime.now(timezone.utc).isoformat()

            if event_type == "login":
                db.guests.update_one(
                    {"_id": guest_id},
                    {"$set": {"lastLogin": now}},
                )
            elif event_type == "access":
                db.guests.update_one(
                    {"_id": guest_id},
                    {"$set": {"lastAccess": now}},
                )

        except Exception:
            logger.exception(f"Failed to process tracking record: {record}")
