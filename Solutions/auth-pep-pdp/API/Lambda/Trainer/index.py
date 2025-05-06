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

    if path == "/trainer" and http_method == "GET":
        return get_trainer(event)
    elif path == "/trainers" and http_method == "GET":
        return list_trainers(event)
    else:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"message": f"Unsupported path or method: {path} {http_method}"}
            ),
        }


def get_trainer(event):
    query_params = event.get("queryStringParameters", {}) or {}
    trainer_id = query_params.get("id")

    if not trainer_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Trainer ID is required"}),
        }

    try:
        response = table.get_item(Key={"PK": f"TRAINER#{trainer_id}", "SK": "PROFILE"})

        trainer = response.get("Item")
        if not trainer:
            return {
                "statusCode": 404,
                "body": json.dumps(
                    {"message": f"Trainer with ID {trainer_id} not found"}
                ),
            }

        trainer_data = {
            "id": trainer_id,
            "name": trainer.get("name", ""),
            "specialization": trainer.get("specialization", ""),
            "yearsExperience": trainer.get("yearsExperience", 0),
            "certifications": trainer.get("certifications", []),
        }

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Trainer details retrieved successfully",
                    "trainer": trainer_data,
                }
            ),
        }

    except Exception as e:
        print(f"Error retrieving trainer: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving trainer details"}),
        }


def list_trainers(event):
    try:
        response = table.scan(FilterExpression=Key("PK").begins_with("TRAINER#"))

        trainers = []
        for item in response.get("Items", []):
            trainer_id = item["PK"].split("#")[1]
            trainers.append(
                {
                    "id": trainer_id,
                    "name": item.get("name", ""),
                    "specialization": item.get("specialization", ""),
                    "yearsExperience": item.get("yearsExperience", 0),
                }
            )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Trainers list retrieved successfully",
                    "trainers": trainers,
                }
            ),
        }

    except Exception as e:
        print(f"Error listing trainers: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error retrieving trainers list"}),
        }
