"""User API Lambda Authorizer - JWT validation for order endpoints."""

import json
import os

import boto3
import jwt

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()

_jwt_public_key = None


@tracer.capture_method
def get_jwt_public_key() -> str:
    """Get JWT public key from Secrets Manager with caching."""
    global _jwt_public_key

    if _jwt_public_key is not None:
        return _jwt_public_key

    secret_name = os.environ.get("JWT_KEYS_SECRET_NAME", "ai-bartender/jwt-keys")
    region = os.environ.get("AWS_REGION", "eu-west-1")

    client = boto3.client("secretsmanager", region_name=region)
    response = client.get_secret_value(SecretId=secret_name)
    secret = json.loads(response["SecretString"])
    _jwt_public_key = secret["public_key"]
    logger.info("JWT public key loaded from Secrets Manager")
    return _jwt_public_key


@tracer.capture_method
def extract_bearer_token(event: dict) -> str:
    """Extract token from Authorization: Bearer header."""
    headers = event.get("headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization") or ""

    if not auth_header.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")

    token = auth_header[7:]
    if not token:
        raise ValueError("Empty token in Authorization header")

    return token


@tracer.capture_method
def validate_jwt_token(token: str) -> dict:
    """Validate JWT token and return claims."""
    public_key = get_jwt_public_key()

    payload = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        options={
            "verify_exp": True,
            "verify_iat": True,
            "require": ["token_type", "username", "user_key", "exp", "iat"],
        },
    )

    if payload.get("token_type") != "access":
        raise ValueError("Invalid token type - expected 'access'")

    logger.info(
        "JWT token validated",
        extra={"user_key": payload.get("user_key"), "username": payload.get("username")},
    )
    return payload


def generate_policy(principal_id: str, effect: str, resource: str, context: dict = None) -> dict:
    """Generate IAM policy for API Gateway."""
    policy = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
    }
    if context:
        policy["context"] = context
    return policy


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """Validate JWT access token and return Allow/Deny policy with user context."""
    method_arn = event.get("methodArn", "")
    logger.info("User authorizer invoked", extra={"method_arn": method_arn})

    try:
        token = extract_bearer_token(event)
        payload = validate_jwt_token(token)

        user_key = payload["user_key"]
        username = payload["username"]

        logger.info("Authorization successful", extra={"user_key": user_key})
        return generate_policy(
            user_key,
            "Allow",
            method_arn,
            context={"user_key": user_key, "username": username},
        )

    except ValueError as e:
        logger.warning("Validation error", extra={"error": str(e)})
        return generate_policy("anonymous", "Deny", method_arn)

    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return generate_policy("anonymous", "Deny", method_arn)

    except jwt.InvalidTokenError as e:
        logger.warning("Invalid JWT token", extra={"error": str(e)})
        return generate_policy("anonymous", "Deny", method_arn)

    except Exception as e:
        logger.exception("Authorization error")
        return generate_policy("anonymous", "Deny", method_arn)
