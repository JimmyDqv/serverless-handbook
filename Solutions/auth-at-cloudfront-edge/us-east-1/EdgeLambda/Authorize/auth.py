import json
import random
import time
import os
import urllib.request
from jose import jwk, jwt
from jose.utils import base64url_decode
import boto3
from botocore.exceptions import ClientError

REGION = "eu-north-1"


def handler(event, context):
    request = event["Records"][0]["cf"]["request"]
    headers = request["headers"]
    domainName = request["headers"]["host"][0]["value"]
    requestedUri = request["uri"]  # we should append querystring

    idToken = ""

    for cookie in headers.get("cookie", []):
        cookiesList = cookie["value"].split(";")
        for subCookie in cookiesList:
            if "idToken" in subCookie:
                idToken = subCookie.split("=")[1]
                break
        if idToken:
            break

    if not idToken:
        print("ID Token not Found! Redirect to login UI")
        return create_redirect_to_login_response()

    jwtHeaders = jwt.get_unverified_headers(idToken)
    kid = jwtHeaders["kid"]

    key_index = -1
    for i in range(len(KEYS)):
        if kid == KEYS[i]["kid"]:
            key_index = i
            break
    if key_index == -1:
        print("Public key not found in jwks.json")
        raise Exception("Public key not found in jwks.json")

    publicKey = jwk.construct(KEYS[key_index])

    message, encoded_signature = str(idToken).rsplit(".", 1)
    decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))
    if not publicKey.verify(message.encode("utf8"), decoded_signature):
        raise Exception("Signature verification failed")

    claims = jwt.get_unverified_claims(idToken)
    if time.time() > claims["exp"]:
        return create_redirect_to_refresh_response()

    if claims["aud"] != CLIENT_ID:
        raise Exception("Token was not issued for this audience")

    return request


def create_redirect_to_login_response():
    response = {
        "status": "307",
        "statusDescription": "Temporary Redirect",
        "headers": {
            "location": [
                {
                    "key": "location",
                    "value": SIGN_IN_URL,
                },
            ],
        },
    }

    return response


def create_redirect_to_refresh_response():
    response = {
        "status": "307",
        "statusDescription": "Temporary Redirect",
        "headers": {
            "location": [
                {
                    "key": "location",
                    "value": REFRESH_URL,
                },
            ],
        },
    }

    return response


def get_secret():
    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager", region_name=REGION)

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=os.environ["USER_POOL_SECRET"]
        )
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
SIGN_IN_URL = os.environ["USER_POOL_HOSTED_UI"]
REFRESH_URL = f"{os.environ['CONTENT_ROOT']}/refresh"

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
