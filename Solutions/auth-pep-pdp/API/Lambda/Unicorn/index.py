import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
unicorn_table = dynamodb.Table(os.environ["UNICORN_TABLE_NAME"])
race_table = dynamodb.Table(os.environ["RACE_TABLE_NAME"])


def handler(event, context):
    print(f"Event: {json.dumps(event)}")

    path = event.get("path", "")
    http_method = event.get("httpMethod", "")

    # Determine which endpoint was called
    if path == "/unicorn" and http_method == "GET":
        return get_unicorn(event)
    elif path == "/unicorns" and http_method == "GET":
        return list_unicorns(event)
    else:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"message": f"Unsupported path or method: {path} {http_method}"}
            ),
        }


def get_unicorn(event):
    query_params = event.get("queryStringParameters", {}) or {}
    unicorn_id = query_params.get("id")
    include_races = query_params.get("include_races", "false").lower() == "true"

    if not unicorn_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Unicorn ID is required"}),
        }

    try:
        response = unicorn_table.get_item(
            Key={"PK": f"UNICORN#{unicorn_id}", "SK": "PROFILE"}
        )

        unicorn = response.get("Item")
        if not unicorn:
            return {
                "statusCode": 404,
                "body": json.dumps(
                    {"message": f"Unicorn with ID {unicorn_id} not found"}
                ),
            }

        unicorn_data = {
            "id": unicorn_id,
            "name": unicorn.get("name", ""),
            "color": unicorn.get("color", ""),
            "magicalAbility": unicorn.get("magicalAbility", ""),
            "age": unicorn.get("age", 0),
        }

        # If requested, include race history
        if include_races:
            races = get_unicorn_races(unicorn_id)
            unicorn_data["races"] = races

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Unicorn details retrieved successfully",
                    "unicorn": unicorn_data,
                }
            ),
        }

    except Exception as e:
        print(f"Error retrieving unicorn: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving unicorn details"}),
        }


def get_unicorn_races(unicorn_id):
    try:
        response = race_table.scan(
            FilterExpression=Key("SK").begins_with(f"UNICORN#{unicorn_id}")
        )

        races = []
        for item in response.get("Items", []):
            race_id = item["PK"].split("#")[1]
            races.append(
                {
                    "raceId": race_id,
                    "date": item.get("raceDate", ""),
                    "position": item.get("position", 0),
                    "time": item.get("time", ""),
                }
            )

        return races
    except Exception as e:
        print(f"Error getting unicorn races: {str(e)}")
        return []


def list_unicorns(event):
    try:
        response = unicorn_table.scan(
            FilterExpression=Key("PK").begins_with("UNICORN#")
        )

        unicorns = []
        for item in response.get("Items", []):
            unicorn_id = item["PK"].split("#")[1]
            unicorns.append(
                {
                    "id": unicorn_id,
                    "name": item.get("name", ""),
                    "color": item.get("color", ""),
                    "magicalAbility": item.get("magicalAbility", ""),
                    "age": item.get("age", 0),
                }
            )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Unicorns list retrieved successfully",
                    "unicorns": unicorns,
                }
            ),
        }

    except Exception as e:
        print(f"Error listing unicorns: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving unicorns list"}),
        }
