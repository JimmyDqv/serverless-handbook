import os
import json
import jwt
import boto3
from jwt import PyJWKClient
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["PERMISSIONS_TABLE"])
JWKS_URL = os.environ["JWKS_URL"]
AUDIENCE = os.environ["AUDIENCE"]


def handler(event, context):
    print(f"Event: {json.dumps(event)}")

    data = event
    jwt_token = data["jwt_token"]
    resource = data["resource"]
    action = data["action"]

    return check_authorization(jwt_token, action, resource)


def check_authorization(jwt_token, action, resource):
    try:
        jwks_client = PyJWKClient(JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(jwt_token)

        decoded_token = jwt.decode(
            jwt_token,
            signing_key.key,
            algorithms=["RS256"],
        )

        role = (
            decoded_token["cognito:groups"][0]
            if "cognito:groups" in decoded_token
            else None
        )

        if not role:
            raise Exception("Unauthorized: Role not found in the token")

        if validate_permission(role, action, resource):
            response_body = generate_access(
                decoded_token["sub"], "Allow", action, resource
            )
            return {
                "statusCode": 200,
                "body": json.dumps(response_body),
                "headers": {"Content-Type": "application/json"},
            }

    except Exception as e:
        print(f"Authorization error: {str(e)}")

    response_body = generate_access(decoded_token["sub"], "Deny", action, resource)

    return {
        "statusCode": 403,
        "body": json.dumps(response_body),
        "headers": {"Content-Type": "application/json"},
    }


def validate_permission(role, action, resource):
    try:
        response = table.query(
            KeyConditionExpression="PK = :role AND SK = :endpoint",
            ExpressionAttributeValues={
                ":role": role,
                ":endpoint": f"{action} {resource}",
            },
        )
        if response["Items"] and response["Items"][0]["Effect"] == "Allow":
            return True
        else:
            return False
    except ClientError as e:
        print(f"Error querying DynamoDB: {e}")
        return False


def generate_access(principal, effect, action, resource):
    auth_response = {
        "principalId": principal,
        "effect": effect,
        "action": action,
        "resource": resource,
    }
    return auth_response
