import json
import base64
import requests
import urllib.request
import boto3
import os
from botocore.exceptions import ClientError

REGION = "eu-north-1"


def handler(event, context):
    request = event["Records"][0]["cf"]["request"]
    headers = request["headers"]
    domainName = request["headers"]["host"][0]["value"]

    base64Bytes = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode("ascii"))
    encodedSecret = base64Bytes.decode("ascii")

    jwt = call_cognito(
        CLIENT_ID,
        request["querystring"].split("=")[1],
        f"https://{domainName}/signin",
        encodedSecret,
    )

    idTokenCookie = f"idToken={jwt['id_token']}"
    accessTokenCookie = f"accessToken={jwt['access_token']}"
    refreshTokenCookie = f"refreshToken={jwt['refresh_token']}"

    response = {
        "status": "307",
        "statusDescription": "Temporary Redirect",
        "headers": {
            "location": [
                {
                    "key": "location",
                    "value": CONTENT_ROOT,
                },
            ],
            "set-cookie": [
                {
                    "key": "Set-Cookie",
                    "value": idTokenCookie,
                    "attributes": "Path=/; Secure; HttpOnly; SameSite=Lax",
                },
                {
                    "key": "Set-Cookie",
                    "value": accessTokenCookie,
                    "attributes": "Path=/; Secure; HttpOnly; SameSite=Lax",
                },
                {
                    "key": "Set-Cookie",
                    "value": refreshTokenCookie,
                    "attributes": "Path=/; Secure; HttpOnly; SameSite=Lax",
                },
            ],
        },
    }

    return response


def call_cognito(clientId, code, redirectUri, encodedSecret):
    payload = {
        "grant_type": "authorization_code",
        "client_id": clientId,
        "code": code,
        "redirect_uri": redirectUri,
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encodedSecret}",
    }

    resp = requests.post(USER_POOL_ENDPOINT, params=payload, headers=headers)
    return resp.json()


def get_secret():
    # Lambda@Edge doesn't support Environment Variables.
    secretName = SECRET_NAME
    regionName = REGION

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager", region_name=regionName)

    try:
        get_secret_value_response = client.get_secret_value(SecretId=secretName)
    except ClientError as e:
        raise e

    secret = get_secret_value_response["SecretString"]
    return secret


# LOAD SSM PARAMETERS
ssm_client = boto3.client("ssm", region_name=REGION)

param = ssm_client.get_parameter(Name="/prod/serverlessAuth/userPoolSecretName")
os.environ["USER_POOL_SECRET"] = param["Parameter"]["Value"]

param = ssm_client.get_parameter(Name="/prod/serverlessAuth/userPoolId")
os.environ["USER_POOL_ID"] = param["Parameter"]["Value"]

param = ssm_client.get_parameter(Name="/prod/serverlessAuth/userPoolEndpoint")
os.environ["USER_POOL_ENDPOINT"] = param["Parameter"]["Value"]

param = ssm_client.get_parameter(Name="/prod/serverlessAuth/userPoolHostedUi")
os.environ["USER_POOL_HOSTED_UI"] = param["Parameter"]["Value"]

param = ssm_client.get_parameter(Name="/prod/serverlessAuth/contentRoot")
os.environ["CONTENT_ROOT"] = param["Parameter"]["Value"]


# CONFIGS
SECRET_NAME = os.environ["USER_POOL_SECRET"]
USER_POOL_ID = os.environ["USER_POOL_ID"]
USER_POOL_ENDPOINT = os.environ["USER_POOL_ENDPOINT"]
SIGN_IN_URL = os.environ["USER_POOL_HOSTED_UI"]
REFRESH_URL = f"{os.environ['CONTENT_ROOT']}/refresh"
CONTENT_ROOT = os.environ["CONTENT_ROOT"]

# Load Secrets and jwks outside of the handler
secret = json.loads(get_secret())
CLIENT_ID = secret["clientId"]
CLIENT_SECRET = secret["clientSecret"]

keys_url = (
    f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
)

with urllib.request.urlopen(keys_url) as f:
    response = f.read()
KEYS = json.loads(response.decode("utf-8"))["keys"]
