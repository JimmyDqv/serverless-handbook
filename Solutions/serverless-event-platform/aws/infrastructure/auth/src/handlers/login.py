import json
import logging

from lib.mongo import get_db
from lib.jwt_helper import sign_token
from lib.response import ok, bad_request, unauthorized, server_error

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event: dict, context) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
        token = (body.get("token") or "").strip()
        last_name = (body.get("lastName") or "").strip().lower()

        if not token or not last_name:
            return bad_request("token and lastName are required")

        db = get_db()
        guest = db.guests.find_one({"token": token})

        if not guest:
            return unauthorized("Invalid token or last name")

        if guest["lastName"].lower() != last_name:
            return unauthorized("Invalid token or last name")

        jwt_token = sign_token(
            sub=guest["_id"],
            first_name=guest["firstName"],
            last_name=guest["lastName"],
            is_admin=guest.get("isAdmin", False),
        )

        return ok({"token": jwt_token})

    except Exception:
        logger.exception("Login error")
        return server_error()
