import boto3
import os
import json
import base64
from Utils import utils
from botocore.exceptions import ClientError

s3_client = boto3.client("s3")
db_client = boto3.client("dynamodb")
bucket_name = os.environ.get("CERTIFICATE_BUCKET_NAME")
dynamodb_table = os.environ.get("DYNAMODB_TABLE")
dynamodb_index = os.environ.get("DYNAMODB_INDEX")


def get_certificate(event):
    base64_fqdn = event.get("pathParameters").get("certificate")
    decoded_bytes = base64.urlsafe_b64decode(base64_fqdn)
    fqdn = decoded_bytes.decode("utf-8")

    certificate = utils.get_certificate(
        db_client,
        dynamodb_table,
        "Root",
        fqdn,
    )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": f"Certificate: {certificate}",
            }
        ),
    }


def list_certificates(event):
    query_params = event.get("queryStringParameters", "{}")
    base64_parent_fqdn = query_params.get("parent")
    decoded_bytes = base64.urlsafe_b64decode(base64_parent_fqdn)
    parent_fqdn = decoded_bytes.decode("utf-8")
    limit = query_params.get("limit", None)

    certs = utils.list_certificates(
        db_client,
        dynamodb_table,
        dynamodb_index,
        parent_fqdn,
        limit,
    )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": f"Certificates: {certs}",
            }
        ),
    }


def handler(event, context):
    resource = event.get("resource")

    if resource == "/certificates":
        return list_certificates(event)
    elif resource == "/certificates/{certificate}":
        return get_certificate(event)

    return {
        "statusCode": 404,
        "body": json.dumps(
            {
                "message": "Not Found",
            }
        ),
    }
