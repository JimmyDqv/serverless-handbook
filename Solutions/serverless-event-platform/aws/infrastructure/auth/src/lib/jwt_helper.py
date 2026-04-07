import json
import os
import time

import boto3
import jwt

_sm = boto3.client("secretsmanager")
_cached_private_key: str | None = None


def _get_private_key() -> str:
    global _cached_private_key
    if _cached_private_key:
        return _cached_private_key
    secret_arn = os.environ["JWT_KEYS_ARN"]
    resp = _sm.get_secret_value(SecretId=secret_arn)
    keys = json.loads(resp["SecretString"])
    _cached_private_key = keys["privateKey"]
    return _cached_private_key


def sign_token(
    sub: str,
    first_name: str,
    last_name: str,
    is_admin: bool,
) -> str:
    private_key = _get_private_key()
    now = int(time.time())
    payload = {
        "sub": sub,
        "firstName": first_name,
        "lastName": last_name,
        "isAdmin": is_admin,
        "iss": "event-platform",
        "aud": "event-platform",
        "iat": now,
        "exp": now + 30 * 24 * 3600,  # 30 days
    }
    return jwt.encode(payload, private_key, algorithm="RS256")
