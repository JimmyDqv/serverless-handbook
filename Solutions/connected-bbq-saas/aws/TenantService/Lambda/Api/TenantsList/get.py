import boto3
import os
import json

dynamodb = boto3.client("dynamodb")
table_name = os.environ["DYNAMODB_TABLE_NAME"]
index_name = os.environ["DYNAMODB_INDEX_NAME"]


def handler(event, context):
    user_id = event["pathParameters"]["userId"]

    response = dynamodb.query(
        TableName=table_name,
        IndexName=index_name,
        KeyConditionExpression="userid = :userid",
        ExpressionAttributeValues={":userid": {"S": user_id}},
    )

    tenants = [item["tenantid"]["S"] for item in response["Items"]]

    return {
        "statusCode": 200,
        "body": json.dumps({"tenants": tenants}),
        "headers": {
            "Access-Control-Allow-Origin": "*",  # Allow all origins
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",  # Allowed methods
        },
    }
