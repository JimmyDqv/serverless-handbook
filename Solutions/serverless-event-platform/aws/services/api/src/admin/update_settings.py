import json
import logging

from lib.mongo import get_db
from lib.response import ok, bad_request, server_error
from lib.tracking import track_access

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    try:
        caller_id = event["requestContext"]["authorizer"]["lambda"]["sub"]
        track_access(caller_id)

        body = json.loads(event.get("body") or "{}")
        rsvp_deadline = (body.get("rsvpDeadline") or "").strip()

        if not rsvp_deadline:
            return bad_request("rsvpDeadline is required")

        db = get_db()
        db.settings.update_one(
            {"_id": "app-settings"},
            {"$set": {"rsvpDeadline": rsvp_deadline}},
            upsert=True,
        )

        return ok({"settings": {"rsvpDeadline": rsvp_deadline}})

    except Exception:
        logger.exception("UpdateSettings error")
        return server_error()
