import os
import json
import jwt
from jwt import PyJWKClient


def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    # Extract the Authorization header
    token = event["headers"].get("authorization", "")

    if not token:
        raise Exception("Unauthorized")

    # Remove 'Bearer ' prefix if it exists
    token = token.replace("Bearer ", "")

    # Decode the JWT token
    try:
        # Fetch the JWKS endpoint from environment variables (e.g., Cognito JWKS URL)
        jwks_url = os.environ["JWKS_URL"]

        # Get the tenantId from the path parameters
        path_tenant_id = event["pathParameters"]["tenantId"]

        # Fetch the JWKs and decode the token
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        decoded_token = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=os.environ["AUDIENCE"],
        )

        # Validate the tenantId
        token_tenant_id = decoded_token.get("tenant")

        if token_tenant_id == path_tenant_id:
            return generate_policy(
                decoded_token["sub"], "Allow", event["methodArn"], decoded_token
            )

    except Exception as e:
        print(f"Authorization error: {str(e)}")
        raise Exception("Unauthorized")

    # Generate a policy that deny access
    return generate_policy(
        decoded_token["sub"], "Deny", event["methodArn"], decoded_token
    )


def generate_policy(principal_id, effect, resource, context):
    auth_response = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {"Action": "execute-api:Invoke", "Effect": effect, "Resource": resource}
            ],
        },
        "context": context,
    }
    return auth_response
