import os
import json
import jwt
import boto3
from jwt import PyJWKClient

lambda_client = boto3.client("lambda")


def handler(event, context):
    print(f"Event: {json.dumps(event)}")

    token = event["headers"].get("authorization", "")
    path = event["path"]
    method = event["httpMethod"]

    if not token:
        raise Exception("Unauthorized")

    token = token.replace("Bearer ", "")

    decoded_token = None
    try:
        jwks_url = os.environ["JWKS_URL"]

        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        decoded_token = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
        )

        if decoded_token["client_id"] != os.environ["AUDIENCE"]:
            raise Exception("Unauthorized: Invalid audience")

        resource_tags = get_resource_tags_for_path(path)

        data = {
            "jwt_token": token,
            "resource": path,
            "action": method,
            "resource_tags": resource_tags,
        }

        response = lambda_client.invoke(
            FunctionName=os.environ["PDP_AUTHZ_ENDPOINT"],
            InvocationType="RequestResponse",
            Payload=json.dumps(data),
        )

        response_payload = json.loads(response["Payload"].read())
        body = json.loads(response_payload["body"])
        effect = body["effect"]

        print(f"Authorization decision: {effect}, Resource Tags: {resource_tags}")

        return generate_policy(
            decoded_token["sub"], effect, event["methodArn"], decoded_token
        )

    except Exception as e:
        print(f"Authorization error: {str(e)}")

    return generate_policy(
        decoded_token["sub"] if decoded_token else "unknown",
        "Deny",
        event["methodArn"],
        decoded_token,
    )


def get_resource_tags_for_path(path):
    if (
        path.startswith("/unicorn")
        or path.startswith("/rider")
        or path.startswith("/trainer")
    ):
        return {"Data": "Unicorn"}
    elif path.startswith("/race"):
        return {"Data": "Races"}
    else:
        return {}


def generate_policy(principal_id, effect, resource, context):
    auth_response = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {"Action": "execute-api:Invoke", "Effect": effect, "Resource": resource}
            ],
        },
    }
    return auth_response
