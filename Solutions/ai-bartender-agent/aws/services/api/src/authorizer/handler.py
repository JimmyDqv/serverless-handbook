"""JWT Token Authorizer for admin endpoints."""

import json
import os

import jwt
import requests

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger()

# Cache JWKS across invocations
_jwks_cache = None


@tracer.capture_method
def get_jwks(region: str, user_pool_id: str) -> dict:
    """Fetch JWKS from Cognito with caching."""
    global _jwks_cache
    if _jwks_cache is None:
        url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


@tracer.capture_method
def get_public_key(token: str, region: str, user_pool_id: str):
    """Get public key for token verification."""
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise ValueError("Token missing 'kid' in header")

    jwks = get_jwks(region, user_pool_id)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))

    raise ValueError(f"Public key not found for kid: {kid}")


@tracer.capture_method
def validate_token(token: str) -> dict:
    """Validate JWT and return claims."""
    region = os.environ.get("AWS_REGION", "eu-west-1")
    user_pool_id = os.environ.get("USER_POOL_ID", "")

    # Get allowed client IDs from environment variable (comma-separated)
    # Falls back to USER_POOL_CLIENT_ID if ALLOWED_CLIENT_IDS not set
    allowed_clients_env = os.environ.get("ALLOWED_CLIENT_IDS", "")
    if allowed_clients_env:
        allowed_client_ids = [cid.strip() for cid in allowed_clients_env.split(",") if cid.strip()]
    else:
        # Fallback to single client ID from USER_POOL_CLIENT_ID
        single_client = os.environ.get("USER_POOL_CLIENT_ID", "")
        allowed_client_ids = [single_client] if single_client else []

    logger.info(
        "Validating token",
        extra={"user_pool_id": user_pool_id, "allowed_clients": allowed_client_ids},
    )

    public_key = get_public_key(token, region, user_pool_id)

    # Access tokens don't have 'aud' claim, they have 'client_id' instead
    # Decode without audience verification first to check token_use
    unverified_claims = jwt.decode(token, options={"verify_signature": False})

    token_use = unverified_claims.get("token_use")
    logger.info("Token type detected", extra={"token_use": token_use})

    # Now verify signature with appropriate audience claim
    if token_use == "access":
        # Access tokens use client_id instead of aud
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}",
            options={"verify_aud": False},  # Access tokens don't have aud claim
        )
        # Manually verify client_id is in allowed list
        token_client_id = claims.get("client_id")
        if token_client_id not in allowed_client_ids:
            raise jwt.InvalidTokenError(
                f"Invalid client_id: {token_client_id} not in allowed clients"
            )
    else:
        # ID tokens use aud claim (fallback for compatibility)
        # Verify with first client ID, but manually check against all allowed IDs
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}",
            options={"verify_aud": False},
        )
        # Manually verify aud is in allowed list
        token_aud = claims.get("aud")
        if token_aud not in allowed_client_ids:
            raise jwt.InvalidTokenError(
                f"Invalid audience: {token_aud} not in allowed clients"
            )

    logger.info(
        "Token validated",
        extra={"token_use": claims.get("token_use"), "sub": claims.get("sub")},
    )
    return claims


def is_admin(claims: dict) -> bool:
    """Check if user has admin role.

    For access tokens, check cognito:groups claim.
    For ID tokens (fallback), also check custom:role attribute.
    """
    # Access tokens use cognito:groups for group membership
    if "admin" in claims.get("cognito:groups", []):
        return True
    # ID tokens can use custom attributes
    if claims.get("custom:role") == "admin":
        return True
    return False


def generate_policy(
    principal_id: str, effect: str, resource: str, context: dict = None
) -> dict:
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
def handler(event: dict, context: LambdaContext) -> dict:
    """Lambda authorizer handler."""
    method_arn = event.get("methodArn", "*")
    logger.info("Authorizer invoked", extra={"event": event})

    try:
        # Extract token from Authorization header
        headers = event.get("headers", {})
        auth_header = headers.get("Authorization") or headers.get("authorization", "")

        if not auth_header.startswith("Bearer "):
            logger.warning("Missing or invalid Authorization header")
            return generate_policy("unknown", "Deny", method_arn)

        token = auth_header[7:]
        logger.info("Calling validate_token", extra={"token": token})
        claims = validate_token(token)

        # Check admin role for /admin/ endpoints
        path = event.get("path", "")
        if "/admin/" in method_arn or path.startswith("/admin/"):
            if not is_admin(claims):
                logger.warning(
                    "User lacks admin role", extra={"user_id": claims.get("sub")}
                )
                return generate_policy(claims.get("sub", "unknown"), "Deny", method_arn)

        user_context = {
            "userId": claims.get("sub", ""),
            "email": claims.get("email", ""),
            "role": claims.get("custom:role", "user"),
        }

        logger.info("Access granted", extra={"user_id": claims.get("sub")})
        return generate_policy(claims.get("sub"), "Allow", method_arn, user_context)

    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return generate_policy("unknown", "Deny", method_arn)
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token", extra={"error": str(e)})
        return generate_policy("unknown", "Deny", method_arn)
    except Exception as e:
        logger.exception("Authorizer error")
        return generate_policy("unknown", "Deny", method_arn)
