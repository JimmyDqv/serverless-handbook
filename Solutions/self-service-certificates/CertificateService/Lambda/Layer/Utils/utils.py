import boto3
import json
import tldextract
import datetime
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr


def is_top_domain(domain):
    extracted = tldextract.extract(domain)
    return extracted.subdomain == "" and extracted.domain and extracted.suffix


def get_top_domain(fqdn):
    extracted = tldextract.extract(fqdn)
    top_domain = f"{extracted.domain}.{extracted.suffix}"
    return top_domain


def file_exists_in_s3(bucket_name, key):
    s3_client = boto3.client("s3")
    try:
        # Attempt to fetch the object's metadata
        s3_client.head_object(Bucket=bucket_name, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        else:
            raise


def get_expiration_date(validity_days):
    expiration_date = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=validity_days
    )

    return expiration_date


def get_expiration_date_as_string(validity_days):
    expiration_date = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=validity_days
    )
    expiration_date_str = expiration_date.strftime("%Y-%m-%d")

    return expiration_date_str


def extract_domain_info(full_domain):
    extracted = tldextract.extract(full_domain)
    top_domain = f"{extracted.domain}.{extracted.suffix}"

    if extracted.subdomain:
        subdomain_parts = extracted.subdomain.split(".")
        if len(subdomain_parts) > 1:
            parent_subdomain = f"{'.'.join(subdomain_parts[1:])}.{top_domain}"
        else:
            parent_subdomain = top_domain
    else:
        parent_subdomain = top_domain

    return top_domain, parent_subdomain


def get_certificate(db_client, table_name, parent_fqdn, cert_fqdn):
    response = db_client.get_item(
        TableName=table_name,
        Key={
            "FQDN": {"S": cert_fqdn},
            "ParentFQDN": {"S": parent_fqdn},
        },
    )
    return dynamodb_to_json(response.get("Item", None))


def list_certificates(db_client, table_name, index_name, parent_fqdn, limit=None):
    results = []
    last_evaluated_key = None

    while True:
        query_params = {
            "TableName": table_name,
            "IndexName": index_name,
            "KeyConditionExpression": "#pfqdn = :parent_fqdn",
            "ExpressionAttributeNames": {"#pfqdn": "ParentFQDN"},
            "ExpressionAttributeValues": {":parent_fqdn": {"S": parent_fqdn}},
        }

        if limit:
            query_params["Limit"] = int(limit)

        if last_evaluated_key:
            query_params["ExclusiveStartKey"] = last_evaluated_key

        response = db_client.query(**query_params)
        items = response.get("Items", [])
        results.extend([dynamodb_to_json(item) for item in items])

        last_evaluated_key = response.get("LastEvaluatedKey", None)

        if not last_evaluated_key or limit:
            break

    return results


def post_event_to_eventbridge(client, event_bus_name, source, detail_type, detail):

    response = client.put_events(
        Entries=[
            {
                "Source": source,
                "DetailType": detail_type,
                "Detail": json.dumps(detail),
                "EventBusName": event_bus_name,
            }
        ]
    )


def dynamodb_to_json(dynamo_item):
    if not isinstance(dynamo_item, dict):
        return dynamo_item

    json_item = {}
    for key, value in dynamo_item.items():
        # DynamoDB attributes are dictionaries with a single key (e.g., "S", "N")
        for attr_type, attr_value in value.items():
            if attr_type == "S":  # String
                json_item[key] = attr_value
            elif attr_type == "N":  # Number
                json_item[key] = (
                    int(attr_value) if attr_value.isdigit() else float(attr_value)
                )
            elif attr_type == "BOOL":  # Boolean
                json_item[key] = bool(attr_value)
            elif attr_type == "NULL":  # Null
                json_item[key] = None
            elif attr_type == "L":  # List
                json_item[key] = [dynamodb_to_json(item) for item in attr_value]
            elif attr_type == "M":  # Map
                json_item[key] = dynamodb_to_json(attr_value)
            else:
                json_item[key] = attr_value  # Default: pass through other types

    return json_item
