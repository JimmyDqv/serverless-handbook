from lib.response import ok


def handler(event: dict, context) -> dict:
    return ok({"message": "ok"})
