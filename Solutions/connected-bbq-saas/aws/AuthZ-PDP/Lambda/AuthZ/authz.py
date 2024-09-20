import os
import json
import jwt
from jwt import PyJWKClient


def handler(event, context):
    data = json.loads(event["body"])
    jwt_token = data["jwt_token"]

    try:
        jwks_url = os.environ["JWKS_URL"]

        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(jwt_token)

        decoded_token = jwt.decode(
            jwt_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=os.environ["AUDIENCE"],
        )

        # Check resource and create AuthZ response
        if data["resource"] == "tenant":
            tenant_id = data["tenant_id"]
            token_tenant_id = decoded_token.get("tenant")

            if token_tenant_id == tenant_id:
                response_body = generate_access(
                    "Allow", data["action"], data["resource"]
                )
                return {
                    "statusCode": 200,
                    "body": json.dumps(response_body),
                    "headers": {"Content-Type": "application/json"},
                }
        elif data["resource"] == "tenantUser":
            user_id = data["user_id"]
            token_user_id = decoded_token.get("cognito:username")

            if token_user_id == user_id:
                response_body = generate_access(
                    "Allow", data["action"], data["resource"]
                )
                return {
                    "statusCode": 200,
                    "body": json.dumps(response_body),
                    "headers": {"Content-Type": "application/json"},
                }

    except Exception as e:
        print(f"Authorization error: {str(e)}")

    # Generate a default response that deny access
    response_body = generate_access("Deny", data["action"], data["resource"])

    return {
        "statusCode": 403,
        "body": json.dumps(response_body),
        "headers": {"Content-Type": "application/json"},
    }


def generate_access(effect, action, resource):
    auth_response = {
        "effect": effect,
        "action": action,
        "resource": resource,
    }
    return auth_response
