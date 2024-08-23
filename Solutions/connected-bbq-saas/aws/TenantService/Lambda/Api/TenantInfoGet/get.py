import json
import os
import json
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")


def handler(event, context):
    tenant_id = event["pathParameters"]["tenantId"]
    table_name = os.environ["DYNAMODB_TABLE_NAME"]

    table = dynamodb.Table(table_name)

    try:
        response = table.query(KeyConditionExpression=Key("tenantid").eq(tenant_id))

        if "Items" in response and len(response["Items"]) > 0:
            return {
                "statusCode": 200,
                "body": json.dumps(response["Items"]),
                "headers": {
                    "Access-Control-Allow-Origin": "*",  # Allow all origins
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",  # Allowed methods
                },
            }
        else:
            return {
                "statusCode": 404,
                "body": json.dumps({"message": "Tenant not found"}),
                "headers": {
                    "Access-Control-Allow-Origin": "*",  # Allow all origins
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",  # Allowed methods
                },
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"message": "Error fetching tenant data", "error": str(e)}
            ),
            "headers": {
                "Access-Control-Allow-Origin": "*",  # Allow all origins
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",  # Allowed methods
            },
        }
