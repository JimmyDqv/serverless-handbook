import json
import logging

from pymongo import ReturnDocument

from lib.mongo import get_db
from lib.response import ok, bad_request, server_error
from lib.tracking import track_access

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ALLOWED_FIELDS = {"status", "numGuests", "dietary", "isAdmin", "expectedGuests"}


def handler(event: dict, context) -> dict:
    try:
        caller_id = event["requestContext"]["authorizer"]["lambda"]["sub"]
        track_access(caller_id)

        guest_id = (event.get("pathParameters") or {}).get("guestId")
        if not guest_id:
            return bad_request("guestId path parameter is required")

        body = json.loads(event.get("body") or "{}")
        updates = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}

        if not updates:
            return bad_request("No valid fields to update")

        db = get_db()
        result = db.guests.find_one_and_update(
            {"_id": guest_id},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

        if not result:
            return bad_request("Guest not found")

        result["_id"] = str(result["_id"])
        return ok({"guest": result})

    except Exception:
        logger.exception("UpdateGuest error")
        return server_error()
