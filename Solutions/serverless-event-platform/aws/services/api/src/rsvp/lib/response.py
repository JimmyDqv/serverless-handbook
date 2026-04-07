import json
from typing import Any

HEADERS = {"Content-Type": "application/json"}


def ok(body: Any) -> dict:
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(body)}


def bad_request(message: str) -> dict:
    return {"statusCode": 400, "headers": HEADERS, "body": json.dumps({"error": message})}


def forbidden(message: str) -> dict:
    return {"statusCode": 403, "headers": HEADERS, "body": json.dumps({"error": message})}


def server_error(message: str = "Internal server error") -> dict:
    return {"statusCode": 500, "headers": HEADERS, "body": json.dumps({"error": message})}
