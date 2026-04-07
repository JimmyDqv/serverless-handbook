import os

import boto3
from pymongo import MongoClient
from pymongo.auth_oidc import OIDCCallback, OIDCCallbackResult

_client = None
_sts = boto3.client("sts")


def _get_oidc_token():
    audience = os.environ["OIDC_AUDIENCE"]
    response = _sts.get_web_identity_token(
        Audience=[audience],
        DurationSeconds=300,
        SigningAlgorithm="RS256",
    )
    return response["WebIdentityToken"]


class AwsOidcCallback(OIDCCallback):
    def fetch(self, context):
        token = _get_oidc_token()
        return OIDCCallbackResult(access_token=token, expires_in_seconds=280)


def get_db():
    global _client
    if _client is None:
        uri = os.environ["MONGODB_URI"]
        properties = {"OIDC_CALLBACK": AwsOidcCallback()}
        _client = MongoClient(
            uri,
            authMechanism="MONGODB-OIDC",
            authMechanismProperties=properties,
        )
    return _client[os.environ.get("MONGODB_DATABASE", "event-platform")]
