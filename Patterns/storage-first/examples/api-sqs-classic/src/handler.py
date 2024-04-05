import json
import boto3

dynamodb = boto3.resource("dynamodb")


def handler(event, context):

    for message in event["Records"]:
        table = dynamodb.Table("data-table")

        response = table.put_item(
            Item={
                "PK": message["messageId"],
                "Data": message["body"],
            }
        )
