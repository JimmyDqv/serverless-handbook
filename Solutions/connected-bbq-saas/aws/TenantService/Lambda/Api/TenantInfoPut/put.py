import os
import json
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")


def handler(event, context):
    tenant_id = event["pathParameters"]["tenantId"]
    table_name = os.environ["DYNAMODB_TABLE_NAME"]

    body = json.loads(event["body"])
    new_name = body.get("name")

    table = dynamodb.Table(table_name)

    try:
        response = table.update_item(
            Key={"tenantid": tenant_id},
            UpdateExpression="set #name = :n",
            ExpressionAttributeNames={"#name": "name"},
            ExpressionAttributeValues={":n": new_name},
            ReturnValues="UPDATED_NEW",
        )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Tenant name updated successfully",
                    "updatedAttributes": response.get("Attributes"),
                },
            ),
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
                {"message": "Error updating tenant name", "error": str(e)}
            ),
            "headers": {
                "Access-Control-Allow-Origin": "*",  # Allow all origins
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",  # Allowed methods
            },
        }
