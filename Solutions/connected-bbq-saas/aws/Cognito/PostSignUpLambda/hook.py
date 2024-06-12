import boto3
import os
import json


def handler(event, context):
    application_name = os.environ["ApplicationName"]
    event_bus = os.environ["EventBusName"]
    event_bus_client = boto3.client("events")

    user_event = {
        "metadata": {
            "domain": "idp",
            "application": application_name,
            "event_type": "signup",
            "version": "1.0",
        },
        "data": {
            "email": event["request"]["userAttributes"]["email"],
            "userName": event["userName"],
            "name": event["request"]["userAttributes"]["name"],
            "verified": event["request"]["userAttributes"]["email_verified"],
            "status": event["request"]["userAttributes"]["cognito:user_status"],
        },
    }

    response = event_bus_client.put_events(
        Entries=[
            {
                "Source": f"{application_name}.idp",
                "DetailType": "signup",
                "Detail": json.dumps(user_event),
                "EventBusName": event_bus,
            },
        ]
    )

    return event
