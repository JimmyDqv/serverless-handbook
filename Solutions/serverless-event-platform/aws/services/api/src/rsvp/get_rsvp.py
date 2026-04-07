import logging

from lib.mongo import get_db
from lib.response import ok, server_error
from lib.tracking import track_access

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    try:
        guest_id = event["requestContext"]["authorizer"]["lambda"]["sub"]
        track_access(guest_id)

        db = get_db()

        guest = db.guests.find_one({"_id": guest_id})
        if not guest:
            return server_error("Guest not found")

        settings = db.settings.find_one({"_id": "app-settings"}) or {}
        rsvp_deadline = settings.get("rsvpDeadline", "")

        guest_data = {
            "_id": str(guest["_id"]),
            "firstName": guest.get("firstName", ""),
            "lastName": guest.get("lastName", ""),
            "status": guest.get("status", "pending"),
            "numGuests": guest.get("numGuests", 0),
            "dietary": guest.get("dietary", ""),
            "rsvpDate": guest.get("rsvpDate"),
            "expectedGuests": guest.get("expectedGuests", 1),
            "groupId": guest.get("groupId"),
        }

        group_members = []
        family_sum = guest_data["expectedGuests"]

        if guest.get("groupId"):
            members = list(db.guests.find({
                "groupId": guest["groupId"],
                "_id": {"$ne": guest["_id"]},
            }))
            for m in members:
                group_members.append({
                    "_id": str(m["_id"]),
                    "firstName": m.get("firstName", ""),
                    "lastName": m.get("lastName", ""),
                    "expectedGuests": m.get("expectedGuests", 1),
                })
                family_sum += m.get("expectedGuests", 1)

        return ok({
            "guest": guest_data,
            "groupMembers": group_members,
            "familySum": family_sum,
            "rsvpDeadline": rsvp_deadline,
        })

    except Exception:
        logger.exception("GetRsvp error")
        return server_error()
