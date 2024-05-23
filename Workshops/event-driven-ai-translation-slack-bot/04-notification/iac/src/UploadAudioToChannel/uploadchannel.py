import json
import os
import boto3
from symbol import parameters
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

SLACK_CHANNEL = os.environ["SLACK_CHANNEL"]


def handler(event, context):
    set_bot_token()

    path = download_audio_file(
        event["VoiceBucket"], event["VoiceKey"], event["Voice"], event["Language"]
    )
    upload_audio_file(event["Language"], path)

    return {"statusCode": 200, "body": "Hello there"}


def download_audio_file(bucket, key, voice, language):
    s3 = boto3.client("s3")
    path = f"/tmp/{language}_{voice}.mp3"
    s3.download_file(bucket, key, path)
    return path


def upload_audio_file(language, path):
    client = WebClient(token=os.environ["SLACK_BOT_TOKEN"])
    client.files_upload_v2(
        channel=SLACK_CHANNEL,
        title="Polly Voiced Translation",
        initial_comment=f"Polly Voiced Translation for: {language}",
        file=path,
    )

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
