# required libraries
import boto3
import json

from cryptography import x509
from cryptography.x509.oid import NameOID


def handler(event, context):
    certificateId = event["CertificateId"]
    region = event["ThingRegion"]
    certificateData = describe_certificate(certificateId, region)

    certificatePem = certificateData["certificateDescription"]["certificatePem"]
    commonName = read_certificate_data(certificatePem)

    return {"Pem": certificatePem, "CommonName": commonName}


def describe_certificate(certificateId, region):
    client = boto3.client("iot", region_name=region)
    response = client.describe_certificate(certificateId=certificateId)
    return response


def read_certificate_data(certificatePem):
    print(certificatePem)
    cert = x509.load_pem_x509_certificate(certificatePem.encode("utf-8"))

    subject = cert.subject
    cn = subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    return cn
