import boto3
import os
import json
import requests
from requests_aws4auth import AWS4Auth

api_endpoint = os.environ.get("TENANT_API_ENDPOINT")


def handler(event, context):
    user_id = event["request"]["userAttributes"]["sub"]

    try:
        session = boto3.Session()
        credentials = session.get_credentials().get_frozen_credentials()

        region = os.environ["AWS_REGION"]
        auth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            region,
            "execute-api",
            session_token=credentials.token,
        )

        response = requests.get(api_endpoint + "/tenants/" + user_id, auth=auth)

        if response.status_code == 200:
            tenants = response.json()["tenants"]

            event["response"]["claimsOverrideDetails"] = {
                "claimsToAddOrOverride": {"tenant": tenants[0]}
            }

            return event

        else:
            print(f"Error fetching tenant: {response.status_code}")
            return event

    except requests.RequestException as e:
        # Handle any exceptions that occur during the API call
        print(f"Error making API request: {str(e)}")

    return event
