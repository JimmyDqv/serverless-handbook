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

        old_group_id = guest.get("groupId")

        db.guests.update_one(
            {"_id": guest_id},
            {"$set": {"groupId": None}},
        )

        updated_guest = db.guests.find_one({"_id": guest_id})
        updated_guest["_id"] = str(updated_guest["_id"])

        remaining = []
        if old_group_id:
            remaining = list(db.guests.find({"groupId": old_group_id}))
            for m in remaining:
                m["_id"] = str(m["_id"])

        return ok({"guest": updated_guest, "remainingGroup": remaining})

    except Exception:
        logger.exception("RemoveFromGroup error")
        return server_error()
