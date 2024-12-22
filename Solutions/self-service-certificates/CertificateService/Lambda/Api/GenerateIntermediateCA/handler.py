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


def create_intermediate_ca(
    root_private_key_pem,
    root_cert_pem,
    fqdn,
    country,
    state,
    organization,
    validity_days,
):
    # Load Root CA private key and certificate
    root_private_key = serialization.load_pem_private_key(
        root_private_key_pem, password=None
    )
    root_cert = x509.load_pem_x509_certificate(root_cert_pem)

    # Generate a private key for the Intermediate CA
    intermediate_private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048
    )
    intermediate_private_key_pem = intermediate_private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Create the Intermediate CA certificate
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
            x509.NameAttribute(NameOID.COMMON_NAME, fqdn),
        ]
    )
    intermediate_certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(root_cert.subject)  # Signed by Root CA
        .public_key(intermediate_private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(utils.get_expiration_date(validity_days))
        .add_extension(
            x509.BasicConstraints(
                ca=True, path_length=0
            ),  # Restricted to issuing leaf certificates
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
        .sign(root_private_key, hashes.SHA256())
    )
    intermediate_cert_pem = intermediate_certificate.public_bytes(
        serialization.Encoding.PEM
    )

    # Create certificate chain (Intermediate CA + Root CA)
    cert_chain_pem = intermediate_cert_pem + root_cert_pem

    return intermediate_private_key_pem, intermediate_cert_pem, cert_chain_pem


def handler(event, context):

    body = json.loads(event["body"])

    bucket_name = os.environ.get("CERTIFICATE_BUCKET_NAME")
    top_domain = utils.get_top_domain(body["fqdn"])

    if utils.is_top_domain(body["fqdn"]):
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"message": "fqdn must not be a top-level domain."},
            ),
        }

    s3_key_root_private_key = f"{top_domain}/root_ca/private_key.pem"
    s3_key_root_cert = f"{top_domain}/root_ca/certificate.pem"

    if not utils.file_exists_in_s3(
        bucket_name, s3_key_root_private_key
    ) or not utils.file_exists_in_s3(bucket_name, s3_key_root_cert):
        return {
            "statusCode": 400,
            "body": json.dumps(
                {
                    "message": "Root CA private key and certificate not found. Please create a Root CA first."
                }
            ),
        }

    # Fetch Root CA private key and certificate from S3
    root_private_key = s3_client.get_object(
        Bucket=bucket_name, Key=s3_key_root_private_key
    )["Body"].read()
    root_cert = s3_client.get_object(Bucket=bucket_name, Key=s3_key_root_cert)[
        "Body"
    ].read()

    # Create Intermediate CA and the certificate chain
    intermediate_private_key_pem, intermediate_cert_pem, cert_chain_pem = (
        create_intermediate_ca(
            root_private_key,
            root_cert,
            body["fqdn"],
            body["country"],
            body["state"],
            body["organization"],
            body["validity_days"],
        )
    )

    s3_client.put_object(
        Bucket=bucket_name,
        Key=f"{top_domain}/{body['fqdn']}/intermediate_ca/private_key.pem",
        Body=intermediate_private_key_pem,
    )
    s3_client.put_object(
        Bucket=bucket_name,
        Key=f"{top_domain}/{body['fqdn']}/intermediate_ca/certificate.pem",
        Body=intermediate_cert_pem,
    )

    # Upload the certificate chain to S3
    s3_client.put_object(
        Bucket=bucket_name,
        Key=f"{top_domain}/{body['fqdn']}/intermediate_ca/certificate_chain.pem",
        Body=cert_chain_pem,
    )

    # Post an event to EventBridge
    utils.post_event_to_eventbridge(
        eb_client,
        os.environ["EVENTBRIDGE_BUS_NAME"],
        "certificates",
        "created",
        {
            "FQDN": body["fqdn"],
            "Type": "Intermediate",
            "ParentFQDN": top_domain,
            "ValidUntil": utils.get_expiration_date_as_string(body["validity_days"]),
        },
    )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {"message": "Intermediate CA and certificate chain created successfully."},
        ),
    }
