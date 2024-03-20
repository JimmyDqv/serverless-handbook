import json
import base64
from urllib import parse as urlparse
import boto3
import os
import re


def handler(event, context):

    msg_map = dict(
        urlparse.parse_qsl(base64.b64decode(str(event["body"])).decode("ascii"))
    )
    commandString = msg_map.get("command", "err")
    text = msg_map.get("text", "err")

    translateText = re.findall(r'"(.*?)"', text)[0]

    text = text.replace(translateText, "")
    text = text.replace('"', "")
    index = text.find("to")
    text = text.replace("to", "").strip()
    languages = text.split(",")

    languageArray = []
    for language in languages:
        language = language.strip()
        languageArray.append(
            {"Code": language},
        )

    commandEvent = {
        "Languages": languageArray,
        "Text": translateText,
        "RequestId": event["requestContext"]["requestId"],
    }

    client = boto3.client("events")
    response = client.put_events(
        Entries=[
            {
                "Source": "Translation",
                "DetailType": "TranslateText",
                "Detail": json.dumps(commandEvent),
                "EventBusName": os.environ["EVENT_BUS_NAME"],
            },
        ]
    )
    return {"statusCode": 200, "body": f"Translating........"}
