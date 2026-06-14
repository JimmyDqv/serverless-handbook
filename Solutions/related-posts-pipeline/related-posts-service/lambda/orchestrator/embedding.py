"""Bedrock Titan Embed v2 wrapper."""
import json
import os
from functools import lru_cache

import boto3

_MODEL_ID = "amazon.titan-embed-text-v2:0"


class EmbeddingError(RuntimeError):
    """Raised when the Bedrock embedding call returns an unexpected response."""


@lru_cache(maxsize=1)
def _bedrock_client():
    return boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "eu-west-1"))


def embed_text(text: str, dimensions: int = 1024) -> list[float]:
    response = _bedrock_client().invoke_model(
        modelId=_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "inputText": text,
            "dimensions": dimensions,
            "normalize": True,
        }),
    )
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    if status != 200:
        raise EmbeddingError(f"Bedrock invoke_model returned HTTP {status}")
    payload = json.loads(response["body"].read())
    if "embedding" not in payload:
        raise EmbeddingError(f"Unexpected Bedrock response body keys: {list(payload.keys())}")
    return [float(x) for x in payload["embedding"]]
