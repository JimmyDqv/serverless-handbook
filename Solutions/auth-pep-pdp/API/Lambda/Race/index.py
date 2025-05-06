import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
race_table = dynamodb.Table(os.environ["RACE_TABLE_NAME"])


def handler(event, context):
    print(f"Event: {json.dumps(event)}")

    path = event.get("path", "")
    http_method = event.get("httpMethod", "")

    if path == "/races" and http_method == "GET":
        return list_races(event)
    elif path == "/race" and http_method == "GET":
        return get_race(event)
    elif path == "/race/results" and http_method == "GET":
        return get_race_results(event)
    else:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"message": f"Unsupported path or method: {path} {http_method}"}
            ),
        }


def list_races(event):
    try:
        response = race_table.scan(FilterExpression=Key("SK").eq("METADATA"))

        races = []
        for item in response.get("Items", []):
            race_id = item["PK"].split("#")[1]
            races.append(
                {
                    "id": race_id,
                    "name": item.get("name", ""),
                    "date": item.get("date", ""),
                    "location": item.get("location", ""),
                    "distance": item.get("distance", ""),
                }
            )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {"message": "Races list retrieved successfully", "races": races}
            ),
        }

    except Exception as e:
        print(f"Error listing races: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving races list"}),
        }


def get_race(event):
    query_params = event.get("queryStringParameters", {}) or {}
    race_id = query_params.get("id")

    if not race_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Race ID is required"}),
        }

    try:
        response = race_table.get_item(Key={"PK": f"RACE#{race_id}", "SK": "METADATA"})

        race = response.get("Item")
        if not race:
            return {
                "statusCode": 404,
                "body": json.dumps({"message": f"Race with ID {race_id} not found"}),
            }

        race_data = {
            "id": race_id,
            "name": race.get("name", ""),
            "date": race.get("date", ""),
            "location": race.get("location", ""),
            "distance": race.get("distance", ""),
            "description": race.get("description", ""),
            "status": race.get("status", ""),
        }

        return {
            "statusCode": 200,
            "body": json.dumps(
                {"message": "Race details retrieved successfully", "race": race_data}
            ),
        }

    except Exception as e:
        print(f"Error retrieving race: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving race details"}),
        }


def get_race_results(event):
    query_params = event.get("queryStringParameters", {}) or {}
    race_id = query_params.get("id")

    if not race_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Race ID is required"}),
        }

    try:
        response = race_table.query(
            KeyConditionExpression=Key("PK").eq(f"RACE#{race_id}")
            & Key("SK").begins_with("UNICORN#")
        )

        if not response.get("Items"):
            return {
                "statusCode": 404,
                "body": json.dumps(
                    {"message": f"No results found for race with ID {race_id}"}
                ),
            }

        metadata_response = race_table.get_item(
            Key={"PK": f"RACE#{race_id}", "SK": "METADATA"}
        )

        race_metadata = metadata_response.get("Item", {})

        results = []
        for item in response.get("Items", []):
            unicorn_id = item["SK"].split("#")[1]
            results.append(
                {
                    "unicornId": unicorn_id,
                    "unicornName": item.get("unicornName", ""),
                    "position": item.get("position", 0),
                    "time": item.get("time", ""),
                    "riderName": item.get("riderName", ""),
                }
            )

        results.sort(key=lambda x: x["position"])

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Race results retrieved successfully",
                    "race": {
                        "id": race_id,
                        "name": race_metadata.get("name", ""),
                        "date": race_metadata.get("date", ""),
                        "location": race_metadata.get("location", ""),
                    },
                    "results": results,
                }
            ),
        }

    except Exception as e:
        print(f"Error retrieving race results: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving race results"}),
        }
