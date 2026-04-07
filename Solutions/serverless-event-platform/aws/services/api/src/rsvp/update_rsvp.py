import json
import logging
from datetime import date, datetime, timezone

from lib.mongo import get_db
from lib.response import ok, bad_request, forbidden, server_error
from lib.tracking import track_access

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    try:
        guest_id = event["requestContext"]["authorizer"]["lambda"]["sub"]
        track_access(guest_id)

        body = json.loads(event.get("body") or "{}")
        num_guests = body.get("numGuests")
        dietary = body.get("dietary", "")
        group_status = body.get("groupStatus")

        if num_guests is None:
            return bad_request("numGuests is required")

        db = get_db()

        settings = db.settings.find_one({"_id": "app-settings"}) or {}
        rsvp_deadline = settings.get("rsvpDeadline", "")

        if rsvp_deadline:
            deadline = date.fromisoformat(rsvp_deadline)
            if date.today() > deadline:
                return forbidden("RSVP is closed")

        now = datetime.now(timezone.utc).isoformat()

        guest = db.guests.find_one({"_id": guest_id})
        if not guest:
            return bad_request("Guest not found")

        db.guests.update_one(
            {"_id": guest_id},
            {"$set": {
                "status": "coming",
                "numGuests": num_guests,
                "dietary": dietary.strip(),
                "rsvpDate": now,
            }},
        )

        if guest.get("groupId") and group_status in ("coming", "declined"):
            db.guests.update_many(
                {"groupId": guest["groupId"], "_id": {"$ne": guest_id}},
                {"$set": {"status": group_status, "numGuests": 0, "rsvpDate": now}},
            )

        updated = db.guests.find_one({"_id": guest_id})
        updated["_id"] = str(updated["_id"])

        return ok({"guest": updated})

    except Exception:
        logger.exception("UpdateRsvp error")
        return server_error()
