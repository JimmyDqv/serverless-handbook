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

        guest_id = (event.get("pathParameters") or {}).get("guestId")
        if not guest_id:
            return bad_request("guestId path parameter is required")

        db = get_db()

        guest = db.guests.find_one({"_id": guest_id})
        if not guest:
            return bad_request("Guest not found")

        db.guests.delete_one({"_id": guest_id})

        return ok({"deleted": guest_id})

    except Exception:
        logger.exception("DeleteGuest error")
        return server_error()
