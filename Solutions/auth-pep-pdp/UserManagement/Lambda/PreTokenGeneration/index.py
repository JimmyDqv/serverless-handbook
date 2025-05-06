import json


def handler(event, context):
    """
    Pre Token Generation Lambda function to include custom attribute in the JWT access token
    """

    user_attributes = event["request"]["userAttributes"]
    claims_to_add_to_access_token = {}

    if "custom:dataAccess" in user_attributes:
        data_access_values = [
            value.strip() for value in user_attributes["custom:dataAccess"].split(",")
        ]
        claims_to_add_to_access_token["custom:dataAccess"] = data_access_values

    response = {
        "claimsAndScopeOverrideDetails": {
            "accessTokenGeneration": {
                "claimsToAddOrOverride": claims_to_add_to_access_token,
            }
        }
    }

    event["response"] = response

    return event
