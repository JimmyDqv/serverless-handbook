import json
import boto3
import os
import random

sqs = boto3.client("sqs")


def handler(event, context):
    body = json.loads(event["Records"][0]["body"])

    if "metadata" not in body:
        payload = {"metadata": {"retryCount": 1}, "data": body}
    else:
        payload = body
        payload["metadata"]["retryCount"] += 1

    if payload["metadata"]["retryCount"] < int(os.environ["RETRY_LIMIT"]):
        send_to_queue(payload, os.environ["QUEUE"])
    else:
        send_to_queue(payload, os.environ["DLQ_QUEUE"])

    return {}


def send_to_queue(payload, queue):

    sqs.send_message(
        QueueUrl=queue,
        MessageBody=json.dumps(payload),
        DelaySeconds=backoff_with_jitter(payload["metadata"]["retryCount"]),
    )


def backoff_with_jitter(retry_count):
    backoff = 2**retry_count
    jitter = random.randint(0, 3000) / 1000
    backoff_with_jitter = backoff + jitter
    return int(backoff_with_jitter)
