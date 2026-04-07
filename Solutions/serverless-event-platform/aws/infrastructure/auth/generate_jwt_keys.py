"""Generate RSA key pair for JWT signing (RS256).

Outputs a JSON string to paste into Secrets Manager:
  event-platform-auth/jwt-keys

Format: {"privateKey": "-----BEGIN PRIVATE KEY-----...", "publicKey": "-----BEGIN PUBLIC KEY-----..."}
"""

import json

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode()

public_pem = private_key.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
).decode()

secret_value = json.dumps({"privateKey": private_pem, "publicKey": public_pem})

print(secret_value)
