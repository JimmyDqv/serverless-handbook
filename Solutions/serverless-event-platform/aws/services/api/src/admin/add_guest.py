import json
import logging
import uuid
from datetime import datetime, timezone

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
        first_name = (body.get("firstName") or "").strip()
        last_name = (body.get("lastName") or "").strip()
        token = (body.get("token") or "").strip()
        is_admin = body.get("isAdmin", False)
        expected_guests = body.get("expectedGuests", 1)

        if not first_name or not last_name or not token:
            return bad_request("firstName, lastName, and token are required")

        guest = {
            "_id": str(uuid.uuid4()),
            "firstName": first_name,
            "lastName": last_name,
            "token": token,
            "status": "pending",
            "numGuests": 0,
            "dietary": "",
            "isAdmin": is_admin,
            "expectedGuests": expected_guests,
            "groupId": None,
            "rsvpDate": None,
            "lastLogin": None,
            "lastAccess": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

        db = get_db()
        db.guests.insert_one(guest)

        return ok({"guest": guest})

    except Exception:
        logger.exception("AddGuest error")
        return server_error()
