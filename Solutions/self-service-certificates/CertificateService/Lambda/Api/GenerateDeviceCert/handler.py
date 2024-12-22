import boto3
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization, hashes
import datetime
import os
import json
import uuid
from Utils import utils
from botocore.exceptions import ClientError

s3_client = boto3.client("s3")
acm_client = boto3.client("acm")
eb_client = boto3.client("events")


def create_device_certificate(
    intermediate_private_key_pem,
    intermediate_cert_pem,
    fqdn,
    country,
    state,
    organization,
    validity_days,
):
    # Load Intermediate CA private key and certificate
    intermediate_private_key = serialization.load_pem_private_key(
        intermediate_private_key_pem, password=None
    )
    intermediate_cert = x509.load_pem_x509_certificate(intermediate_cert_pem)

    # Generate a private key for the server certificate
    server_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_private_key_pem = server_private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    subject = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
            x509.NameAttribute(NameOID.COMMON_NAME, fqdn),
        ]
    )
    server_certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(intermediate_cert.subject)  # Signed by Intermediate CA
        .public_key(server_private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(utils.get_expiration_date(validity_days))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName(fqdn)]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                key_cert_sign=False,
                crl_sign=False,
                content_commitment=False,
                data_encipherment=False,
                encipher_only=False,
                decipher_only=False,
                key_agreement=False,
            ),
            critical=True,
        )
        .sign(intermediate_private_key, hashes.SHA256())
    )
    server_cert_pem = server_certificate.public_bytes(serialization.Encoding.PEM)

    return server_private_key_pem, server_cert_pem


def handler(event, context):

    body = json.loads(event["body"])

    bucket_name = os.environ.get("CERTIFICATE_BUCKET_NAME")

    top_domain = utils.get_top_domain(body["parent_fqdn"])
    parent_domain = body["parent_fqdn"]
    device_uuid = uuid.uuid4()
    device_fqdn = f"{device_uuid}.{parent_domain}"

    s3_intermediate_ca_private_key = (
        f"{top_domain}/{parent_domain}/intermediate_ca/private_key.pem"
    )
    s3_intermediate_ca_cert_key = (
        f"{top_domain}/{parent_domain}/intermediate_ca/certificate.pem"
    )
    s3_intermediate_ca_chain_key = (
        f"{top_domain}/{parent_domain}/intermediate_ca/certificate_chain.pem"
    )

    if not utils.file_exists_in_s3(
        bucket_name, s3_intermediate_ca_private_key
    ) or not utils.file_exists_in_s3(bucket_name, s3_intermediate_ca_cert_key):
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Intermediate CA not found in S3."}),
        }

    # Fetch Intermediate CA private key and certificate from S3
    intermediate_private_key = s3_client.get_object(
        Bucket=bucket_name, Key=s3_intermediate_ca_private_key
    )["Body"].read()

    intermediate_cert = s3_client.get_object(
        Bucket=bucket_name, Key=s3_intermediate_ca_cert_key
    )["Body"].read()

    # Fetch the certificate chain from S3
    cert_chain_pem = s3_client.get_object(
        Bucket=bucket_name, Key=s3_intermediate_ca_chain_key
    )["Body"].read()

    # Create Device Certificate
    device_private_key_pem, device_cert_pem = create_device_certificate(
        intermediate_private_key,
        intermediate_cert,
        device_fqdn,
        body["country"],
        body["state"],
        body["organization"],
        body["validity_days"],
    )

    s3_folder = f"{top_domain}/{parent_domain}/device_certificates/{device_uuid}"

    # Upload Server Certificate, Private Key to S3
    s3_client.put_object(
        Bucket=bucket_name,
        Key=f"{s3_folder}/private_key.pem",
        Body=device_private_key_pem,
    )
    s3_client.put_object(
        Bucket=bucket_name, Key=f"{s3_folder}/certificate.pem", Body=device_cert_pem
    )

    # Post an event to EventBridge
    utils.post_event_to_eventbridge(
        eb_client,
        os.environ["EVENTBRIDGE_BUS_NAME"],
        "certificates",
        "created",
        {
            "FQDN": device_fqdn,
            "Type": "Client",
            "ParentFQDN": parent_domain,
            "ValidUntil": utils.get_expiration_date_as_string(body["validity_days"]),
        },
    )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "Device certificate created, uploaded to S3",
                "fqdn": device_fqdn,
                "s3_folder": s3_folder,
            }
        ),
    }
