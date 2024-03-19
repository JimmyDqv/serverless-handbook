import json
import os
import boto3

sfn_client = boto3.client("stepfunctions", region_name="eu-north-1")
state_machine_arn = "<add arn here>"


def handler(event, context):
    request = event["Records"][0]["cf"]["request"]
    try:
        if request["uri"].endswith(".html"):
            start_state_machine(event["Records"][0])
    except:
        pass
    return request


def start_state_machine(event):
    sfn_client.start_execution(
        stateMachineArn=state_machine_arn, input=json.dumps(event)
    )
