import logging

from lib.mongo import get_db
from lib.response import ok, server_error
from lib.tracking import track_access

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    try:
        caller_id = event["requestContext"]["authorizer"]["lambda"]["sub"]
        track_access(caller_id)

        db = get_db()

        stats_result = list(db.guests.aggregate([
            {"$group": {
                "_id": None,
                "totalInvited": {"$sum": 1},
                "totalComing": {"$sum": {"$cond": [{"$eq": ["$status", "coming"]}, 1, 0]}},
                "totalGuests": {"$sum": {"$cond": [{"$eq": ["$status", "coming"]}, "$numGuests", 0]}},
                "totalExpected": {"$sum": "$expectedGuests"},
                "withAllergies": {"$sum": {"$cond": [
                    {"$and": [{"$eq": ["$status", "coming"]}, {"$ne": ["$dietary", ""]}]},
                    1, 0
                ]}},
            }}
        ]))
        stats = stats_result[0] if stats_result else {}
        stats.pop("_id", None)

        guests = list(db.guests.find())
        for g in guests:
            g["_id"] = str(g["_id"])

        settings = db.settings.find_one({"_id": "app-settings"}) or {}
        settings.pop("_id", None)

        return ok({"guests": guests, "settings": settings, "stats": stats})

    except Exception:
        logger.exception("ListGuests error")
        return server_error()
