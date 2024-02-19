import json
import base64
import requests
import boto3
import os
from botocore.exceptions import ClientError

REGION = "eu-north-1"
# LOAD SSM PARAMETERS
ssm_client = boto3.client("ssm", region_name=REGION)

param = ssm_client.get_parameter(Name="/prod/serverlessAuth/userPoolHostedUi")
os.environ["SIGN_IN_URL"] = param["Parameter"]["Value"]


def handler(event, context):
    request = event["Records"][0]["cf"]["request"]
    headers = request["headers"]
    domainName = request["headers"]["host"][0]["value"]

    idTokenCookie = ""
    accessTokenCookie = ""
    refreshTokenCookie = ""

    # Check for the ID Token cookie
    for cookie in headers.get("cookie", []):
        cookiesList = cookie["value"].split(";")
        for subCookie in cookiesList:
            if "idToken" in subCookie:
                idTokenCookie = subCookie
            if "accessToken" in subCookie:
                accessTokenCookie = subCookie
            if "refreshToken" in subCookie:
                refreshTokenCookie = subCookie

    response = {
        "status": "307",
        "statusDescription": "Temporary Redirect",
        "headers": {
            "location": [
                {
                    "key": "location",
                    "value": os.environ["SIGN_IN_URL"],
                },
            ],
            "set-cookie": [
                {
                    "key": "Set-Cookie",
                    "value": idTokenCookie,
                    "attributes": "Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
                },
                {
                    "key": "Set-Cookie",
                    "value": accessTokenCookie,
                    "attributes": "Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
                },
                {
                    "key": "Set-Cookie",
                    "value": refreshTokenCookie,
                    "attributes": "Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
                },
            ],
        },
    }

    return response
