import json
import os
import boto3
from symbol import parameters
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

SLACK_CHANNEL = os.environ["SLACK_CHANNEL"]


def handler(event, context):
    set_bot_token()

    text = f"{event['Language']}:\n{event['Text']['Body']}"

    client = WebClient(token=os.environ["SLACK_BOT_TOKEN"])
    client.chat_postMessage(channel=SLACK_CHANNEL, text=text)

    return {"statusCode": 200, "body": "Hello there"}


def set_bot_token():
    os.environ["SLACK_BOT_TOKEN"] = get_secret()


def get_secret():
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager")

    try:
        secretValueResponse = client.get_secret_value(
            SecretId=os.environ["SLACK_BOT_TOKEN_ARN"]
        )
    except ClientError as e:
        raise e

    secret = json.loads(secretValueResponse["SecretString"])["OauthToken"]
    return secret
