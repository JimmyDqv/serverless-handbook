#!/usr/bin/env python3
"""
Setup JWT Keys for User Authentication

This script generates an RSA key pair and stores it in AWS Secrets Manager
for use in JWT token signing and verification.

Usage:
    python3 setup-jwt-keys.py [--secret-name SECRET_NAME] [--region REGION] [--profile PROFILE]

Requirements:
    - OpenSSL installed
    - AWS CLI configured with appropriate credentials
    - boto3 Python package (pip install boto3)

Examples:
    python3 setup-jwt-keys.py --profile <your-aws-profile> --region us-west-1
    python3 setup-jwt-keys.py --profile <your-aws-profile> --region eu-west-1
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

import boto3
from botocore.exceptions import ClientError


def generate_rsa_keypair(key_size=2048):
    """Generate RSA key pair using OpenSSL. Returns (private_key_pem, public_key_pem)."""
    print(f"Generating {key_size}-bit RSA key pair...")

    with tempfile.TemporaryDirectory() as tmpdir:
        private_key_path = os.path.join(tmpdir, "private.pem")
        public_key_path = os.path.join(tmpdir, "public.pem")

        try:
            subprocess.run(
                ["openssl", "genrsa", "-out", private_key_path, str(key_size)],
                check=True,
                capture_output=True,
                text=True,
            )

            subprocess.run(
                [
                    "openssl",
                    "rsa",
                    "-in",
                    private_key_path,
                    "-pubout",
                    "-out",
                    public_key_path,
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            with open(private_key_path, "r") as f:
                private_key = f.read()

            with open(public_key_path, "r") as f:
                public_key = f.read()

            print("✓ RSA key pair generated successfully")
            return private_key, public_key

        except subprocess.CalledProcessError as e:
            print(f"✗ Error generating keys: {e.stderr}", file=sys.stderr)
            sys.exit(1)
        except FileNotFoundError:
            print(
                "✗ Error: OpenSSL not found. Please install OpenSSL.", file=sys.stderr
            )
            sys.exit(1)


def create_or_update_secret(secret_name, private_key, public_key, region, profile=None):
    """Create or update the JWT keys secret in Secrets Manager."""
    session = boto3.Session(profile_name=profile, region_name=region)
    client = session.client("secretsmanager")

    secret_value = {
        "private_key": private_key,
        "public_key": public_key,
        "algorithm": "RS256",
    }

    try:
        print(f"Creating secret '{secret_name}' in region '{region}'...")
        client.create_secret(
            Name=secret_name,
            Description="RSA key pair for JWT token signing and verification",
            SecretString=json.dumps(secret_value),
        )
        print(f"✓ Secret '{secret_name}' created successfully")

    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceExistsException":
            print(f"Secret '{secret_name}' already exists. Updating...")
            try:
                client.put_secret_value(
                    SecretId=secret_name, SecretString=json.dumps(secret_value)
                )
                print(f"✓ Secret '{secret_name}' updated successfully")
            except ClientError as update_error:
                print(f"✗ Error updating secret: {update_error}", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"✗ Error creating secret: {e}", file=sys.stderr)
            sys.exit(1)


def verify_secret(secret_name, region, profile=None):
    """Verify the secret was created/updated correctly."""
    print(f"\nVerifying secret '{secret_name}'...")
    session = boto3.Session(profile_name=profile, region_name=region)
    client = session.client("secretsmanager")

    try:
        response = client.get_secret_value(SecretId=secret_name)
        secret_data = json.loads(response["SecretString"])

        required_keys = ["private_key", "public_key", "algorithm"]
        missing_keys = [key for key in required_keys if key not in secret_data]

        if missing_keys:
            print(f"✗ Secret is missing keys: {missing_keys}", file=sys.stderr)
            return False

        private_key = secret_data["private_key"]
        if not (
            private_key.startswith("-----BEGIN RSA PRIVATE KEY-----")
            or private_key.startswith("-----BEGIN PRIVATE KEY-----")
        ):
            print("✗ Private key format appears invalid", file=sys.stderr)
            return False

        if not secret_data["public_key"].startswith("-----BEGIN PUBLIC KEY-----"):
            print("✗ Public key format appears invalid", file=sys.stderr)
            return False

        print("✓ Secret verification passed")
        print("\nSecret details:")
        print(f"  Name: {secret_name}")
        print(f"  Region: {region}")
        print(f"  Algorithm: {secret_data['algorithm']}")
        print(f"  Private key length: {len(secret_data['private_key'])} chars")
        print(f"  Public key length: {len(secret_data['public_key'])} chars")

        return True

    except ClientError as e:
        print(f"✗ Error verifying secret: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate RSA keys and store in AWS Secrets Manager for JWT authentication"
    )
    parser.add_argument(
        "--secret-name",
        default="ai-bartender/jwt-keys",
        help="Name of the secret in Secrets Manager (default: ai-bartender/jwt-keys)",
    )
    parser.add_argument(
        "--region", default="eu-west-1", help="AWS region (default: eu-west-1)"
    )
    parser.add_argument(
        "--key-size",
        type=int,
        default=2048,
        choices=[2048, 3072, 4096],
        help="RSA key size in bits (default: 2048)",
    )
    parser.add_argument(
        "--profile",
        default=None,
        help="AWS CLI profile to use (default: use default credentials)",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("JWT Keys Setup for AI Bartender")
    print("=" * 60)
    print()

    private_key, public_key = generate_rsa_keypair(args.key_size)
    create_or_update_secret(
        args.secret_name, private_key, public_key, args.region, args.profile
    )

    if verify_secret(args.secret_name, args.region, args.profile):
        print("\n" + "=" * 60)
        print("✓ Setup completed successfully!")
        print("=" * 60)
        print("\nThe JWT keys are now ready for use by the registration endpoint.")
        print(f"Lambda functions can access them via: {args.secret_name}")
    else:
        print("\n✗ Setup completed with warnings. Please verify the secret manually.")
        sys.exit(1)


if __name__ == "__main__":
    main()
