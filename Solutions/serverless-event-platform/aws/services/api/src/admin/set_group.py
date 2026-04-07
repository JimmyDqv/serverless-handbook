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

        guest_id = (event.get("pathParameters") or {}).get("guestId")
        if not guest_id:
            return bad_request("guestId path parameter is required")

        body = json.loads(event.get("body") or "{}")
        group_id = (body.get("groupId") or "").strip()
        if not group_id:
            return bad_request("groupId is required")

        db = get_db()

        guest = db.guests.find_one({"_id": guest_id})
        if not guest:
            return bad_request("Guest not found")

        db.guests.update_one(
            {"_id": guest_id},
            {"$set": {"groupId": group_id}},
        )

        group_members = list(db.guests.find({"groupId": group_id}))
        for m in group_members:
            m["_id"] = str(m["_id"])

        return ok({"guests": group_members})

    except Exception:
        logger.exception("SetGroup error")
        return server_error()
