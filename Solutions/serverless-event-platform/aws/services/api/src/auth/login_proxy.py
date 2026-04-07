import base64
import json
import logging
import os

import boto3

from lib.response import ok, bad_request, server_error
from lib.tracking import track_login

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_lambda = boto3.client("lambda")


def handler(event: dict, context) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
        token = (body.get("token") or "").strip()
        last_name = (body.get("lastName") or "").strip()

        if not token or not last_name:
            return bad_request("token and lastName are required")

        pdp_function = os.environ["LOGIN_FUNCTION_NAME"]

        response = _lambda.invoke(
            FunctionName=pdp_function,
            InvocationType="RequestResponse",
            Payload=json.dumps({
                "body": json.dumps({"token": token, "lastName": last_name}),
            }),
        )

        pdp_result = json.loads(response["Payload"].read())

        # Track login if successful
        if pdp_result.get("statusCode") == 200:
            try:
                pdp_body = json.loads(pdp_result.get("body", "{}"))
                jwt_token = pdp_body.get("token", "")
                if jwt_token:
                    payload = json.loads(base64.b64decode(jwt_token.split(".")[1] + "=="))
                    track_login(payload["sub"])
            except Exception:
                pass

        # Forward the PDP response status and body
        return {
            "statusCode": pdp_result.get("statusCode", 500),
            "headers": {"Content-Type": "application/json"},
            "body": pdp_result.get("body", "{}"),
        }

    except Exception:
        logger.exception("Login proxy error")
        return server_error()
