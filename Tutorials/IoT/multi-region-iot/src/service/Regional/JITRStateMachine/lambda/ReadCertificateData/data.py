# required libraries
import boto3
import json
import logging
import os

from cryptography import x509
from cryptography.x509.oid import NameOID


def handler(event, context):
    certificateId = event["certificateId"]
    certficiatePem = event["CertificateInfo"]["CertificateDescription"][
        "CertificatePem"
    ]

    cn = read_certificate_data(certficiatePem)
    return {"CommonName": cn}


def read_certificate_data(certificatePem):
    print(certificatePem)
    cert = x509.load_pem_x509_certificate(certificatePem.encode("utf-8"))

    subject = cert.subject
    cn = subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
    print(f"subject: {subject} cn: {cn}")

    return cn
