"""CORS OPTIONS handler for preflight requests."""

import os


def handler(event, context):
    """Handle CORS preflight OPTIONS requests.

    Returns appropriate CORS headers for browser preflight checks.
    """
    allowed_origin = os.environ.get("ALLOWED_ORIGIN", "*")

    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Accept-Language,X-Registration-Code",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Max-Age": "600",
        },
        "body": "",
    }
