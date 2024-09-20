import os
import json
import jwt
import requests
import boto3
from jwt import PyJWKClient
from requests_aws4auth import AWS4Auth

api_endpoint = os.environ.get("PDP_AUTHZ_API_ENDPOINT")


def handler(event, context):
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

        # Fetch the JWKs and decode the token
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        decoded_token = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=os.environ["AUDIENCE"],
        )

        # Get AWS credentials
        session = boto3.Session()
        credentials = session.get_credentials().get_frozen_credentials()

        # Set up AWS4Auth using the credentials
        region = os.environ["AWS_REGION"]  # Set your region
        auth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            region,
            "execute-api",
            session_token=credentials.token,
        )

        # Call the PDP Endpoint to verify the access
        data = {
            "jwt_token": token,
            "resource": "tenantUser",
            "action": "read",
            "resource_path": event["path"],
            "user_id": event["pathParameters"]["userId"],
        }
        headers = {"Content-type": "application/json"}
        response = requests.post(
            api_endpoint + "/authz", data=json.dumps(data), headers=headers, auth=auth
        )

        # Generate a policy based on the response
        if response.status_code == 200:
            return generate_policy(
                decoded_token["sub"], "Allow", event["methodArn"], decoded_token
            )
        else:
            return generate_policy(
                decoded_token["sub"], "Deny", event["methodArn"], decoded_token
            )

    except Exception as e:
        print(f"Authorization error: {str(e)}")

    # Generate a policy that allows access
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
