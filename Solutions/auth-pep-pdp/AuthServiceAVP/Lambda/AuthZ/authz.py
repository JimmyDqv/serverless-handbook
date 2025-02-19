import json
import os
import base64
import boto3
import time
from datetime import datetime, timedelta, timezone

policy_store_id = os.getenv("POLICY_STORE_ID")
namespace = os.getenv("NAMESPACE")
token_type = os.getenv("TOKEN_TYPE")
resource_type = f"{namespace}::Application"
resource_id = namespace
action_type = f"{namespace}::Action"
table_name = os.environ["PERMISSION_CACHE_TABLE"]

avp_client = boto3.client("verifiedpermissions")
dynamodb_client = boto3.client("dynamodb")


def decode_token(bearer_token):
    return json.loads(base64.b64decode(bearer_token.split(".")[1]).decode("utf-8"))


def generate_access(principal, effect, action, resource):
    auth_response = {
        "statusCode": 200 if effect == "Allow" else 403,
        "principalId": principal,
        "effect": effect,
        "action": action,
        "resource": resource,
    }
    return auth_response


def get_auth_cache(principal, action):
    try:
        response = dynamodb_client.get_item(
            TableName=table_name, Key={"PK": {"S": principal}, "SK": {"S": action}}
        )

        item = response.get("Item")
        if not item:
            return None

        ttl = int(item.get("TTL")["N"])
        if ttl and ttl < int(time.time() * 1000):  # TTL is in milliseconds
            return None

        return item.get("Effect")["S"]

    except Exception as e:
        print(f"Error getting auth cache: {e}")
        return None


def store_auth_cache(principal, action, auth_response):
    try:
        ttl = int((datetime.now(timezone.utc) + timedelta(hours=12)).timestamp() * 1000)

        effect = (
            "Allow" if auth_response.get("decision", "").upper() == "ALLOW" else "Deny"
        )

        dynamodb_client.put_item(
            TableName=table_name,
            Item={
                "PK": {"S": principal},
                "SK": {"S": action},
                "TTL": {"N": str(ttl)},
                "Effect": {"S": effect},
            },
        )

    except Exception as e:
        print(f"Error storing auth cache: {e}")


def validate_permission(event):
    jwt_token = event["jwt_token"]
    resource = event["resource"]
    action = event["action"]
    parsed_token = decode_token(jwt_token)

    try:
        action_id = f"{action.lower()} {resource.lower()}"
        user_principal = parsed_token["sub"]

        cached_auth = get_auth_cache(user_principal, action_id)

        if cached_auth is None:
            auth_response = avp_client.is_authorized_with_token(
                accessToken=jwt_token,
                policyStoreId=policy_store_id,
                action={"actionType": action_type, "actionId": action_id},
                resource={"entityType": resource_type, "entityId": resource_id},
            )

            store_auth_cache(user_principal, action_id, auth_response)

            response_body = generate_access(
                user_principal,
                "Allow" if auth_response["decision"].upper() == "ALLOW" else "Deny",
                action,
                resource,
            )

            return {
                "statusCode": 200,
                "body": json.dumps(response_body),
                "headers": {"Content-Type": "application/json"},
            }

        else:
            response_body = generate_access(
                user_principal, cached_auth, action, resource
            )

            return {
                "statusCode": 200,
                "body": json.dumps(response_body),
                "headers": {"Content-Type": "application/json"},
            }

    except Exception as e:
        print(f"Error validating permissions: {e}")

    response_body = generate_access(parsed_token["sub"], "Deny", action, resource)

    return {
        "statusCode": 200,
        "body": json.dumps(response_body),
        "headers": {"Content-Type": "application/json"},
    }


def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    permissions = validate_permission(event)
    return permissions
