import boto3
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization, hashes
import datetime
import os
import json
from Utils import utils

s3_client = boto3.client("s3")
eb_client = boto3.client("events")


def create_root_ca(fqdn, country, state, organization, validity_days):
    # Generate a private key for the Root CA
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Create the Root CA certificate
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
            x509.NameAttribute(NameOID.COMMON_NAME, fqdn),
        ]
    )
    root_certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(utils.get_expiration_date(validity_days))
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                content_commitment=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(private_key, hashes.SHA256())
    )
    root_cert_pem = root_certificate.public_bytes(serialization.Encoding.PEM)

    return private_key_pem, root_cert_pem


def handler(event, context):

    body = json.loads(event["body"])

    if not utils.is_top_domain(body["fqdn"]):
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"message": "fqdn must be a top-level domain"},
            ),
        }

    bucket_name = os.environ.get("CERTIFICATE_BUCKET_NAME")
    if not bucket_name:
        return {
            "statusCode": 500,
            "body": "S3_BUCKET_NAME environment variable is not set.",
        }

    private_key_pem, root_cert_pem = create_root_ca(
        body["fqdn"],
        body["country"],
        body["state"],
        body["organization"],
        body["validity_days"],
    )

    # Upload Root CA private key and certificate to S3
    s3_client.put_object(
        Bucket=bucket_name,
        Key=f"{body['fqdn']}/root_ca/private_key.pem",
        Body=private_key_pem,
    )
    s3_client.put_object(
        Bucket=bucket_name,
        Key=f"{body['fqdn']}/root_ca/certificate.pem",
        Body=root_cert_pem,
    )

    # Post an event to EventBridge
    utils.post_event_to_eventbridge(
        eb_client,
        os.environ["EVENTBRIDGE_BUS_NAME"],
        "certificates",
        "created",
        {
            "FQDN": body["fqdn"],
            "Type": "Root",
            "ParentFQDN": "Root",
            "ValidUntil": utils.get_expiration_date_as_string(body["validity_days"]),
        },
    )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {"message": "Root CA created successfully"},
        ),
    }
