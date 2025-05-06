import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["UNICORN_TABLE_NAME"])


def handler(event, context):
    print(f"Event: {json.dumps(event)}")

    path = event.get("path", "")
    http_method = event.get("httpMethod", "")

    if path == "/rider" and http_method == "GET":
        return get_rider(event)
    elif path == "/riders" and http_method == "GET":
        return list_riders(event)
    else:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"message": f"Unsupported path or method: {path} {http_method}"}
            ),
        }


def get_rider(event):
    query_params = event.get("queryStringParameters", {}) or {}
    rider_id = query_params.get("id")

    if not rider_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Rider ID is required"}),
        }

    try:
        response = table.get_item(Key={"PK": f"RIDER#{rider_id}", "SK": "PROFILE"})

        rider = response.get("Item")
        if not rider:
            return {
                "statusCode": 404,
                "body": json.dumps({"message": f"Rider with ID {rider_id} not found"}),
            }

        rider_data = {
            "id": rider_id,
            "name": rider.get("name", ""),
            "level": rider.get("level", ""),
            "experience": rider.get("experience", 0),
            "joinedDate": rider.get("joinedDate", ""),
        }

        return {
            "statusCode": 200,
            "body": json.dumps(
                {"message": "Rider details retrieved successfully", "rider": rider_data}
            ),
        }

    except Exception as e:
        print(f"Error retrieving rider: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving rider details"}),
        }


def list_riders(event):
    try:
        response = table.scan(FilterExpression=Key("PK").begins_with("RIDER#"))

        riders = []
        for item in response.get("Items", []):
            rider_id = item["PK"].split("#")[1]
            riders.append(
                {
                    "id": rider_id,
                    "name": item.get("name", ""),
                    "level": item.get("level", ""),
                }
            )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {"message": "Riders list retrieved successfully", "riders": riders}
            ),
        }

    except Exception as e:
        print(f"Error listing riders: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving riders list"}),
        }
