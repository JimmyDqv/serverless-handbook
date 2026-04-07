import json
import os
import logging

import boto3
import jwt

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_sm = boto3.client("secretsmanager")
_cached_public_key: str | None = None


def _get_public_key() -> str:
    global _cached_public_key
    if _cached_public_key:
        return _cached_public_key
    secret_arn = os.environ["JWT_KEYS_ARN"]
    resp = _sm.get_secret_value(SecretId=secret_arn)
    keys = json.loads(resp["SecretString"])
    _cached_public_key = keys["publicKey"]
    return _cached_public_key


def handler(event: dict, context) -> dict:
    try:
        auth_header = (event.get("headers") or {}).get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return {"isAuthorized": False}

        token = auth_header[7:]
        public_key = _get_public_key()

        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer="event-platform",
            audience="event-platform",
            options={"verify_exp": False},
        )

        # PEP: enforce admin-only access
        if not decoded.get("isAdmin", False):
            return {"isAuthorized": False}

        return {
            "isAuthorized": True,
            "context": {
                "sub": decoded["sub"],
                "firstName": decoded["firstName"],
                "lastName": decoded["lastName"],
                "isAdmin": str(decoded["isAdmin"]),
            },
        }

    except Exception:
        logger.exception("Authorizer error")
        return {"isAuthorized": False}
