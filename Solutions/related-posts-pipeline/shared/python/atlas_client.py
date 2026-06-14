"""Canonical MongoDB Atlas client for the related-posts pipeline.

This file lives ONCE in `shared/python/` and is copied into each consuming
Lambda's build artifacts by that Lambda's Makefile (`BuildMethod: makefile`
+ `build_in_source: true` in samconfig). Do not create per-Lambda copies.

Authentication model: the Lambda's execution role does NOT authenticate to
Atlas directly. Instead, it assumes a dedicated role (`ATLAS_ROLE_ARN`,
provisioned by the atlas-roles stack and federated once with Atlas) via STS
and passes those temporary credentials to pymongo's MONGODB-AWS mechanism.

Splitting the federated role from each Lambda's execution role means
re-deploying or adding Lambdas never requires re-federating Atlas — the
single shared role stays federated forever.
"""
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import boto3
import certifi
from pymongo import MongoClient

logger = logging.getLogger(__name__)

# Refresh the assumed-role credentials slightly before they expire so an
# in-flight request never sees an InvalidSignature.
_CREDS_REFRESH_BUFFER = timedelta(minutes=2)

# Module-level cache. Cleared when the assumed-role creds approach expiry.
_atlas_state: dict = {"client": None, "creds_expiry": None}


@lru_cache(maxsize=1)
def _connection_config() -> dict:
    arn = os.environ["ATLAS_SECRET_ARN"]
    sm = boto3.client("secretsmanager", region_name=os.environ.get("AWS_REGION", "eu-west-1"))
    return json.loads(sm.get_secret_value(SecretId=arn)["SecretString"])


def _assume_atlas_role() -> dict:
    """Assume the dedicated Atlas RW role and return STS credentials."""
    role_arn = os.environ["ATLAS_ROLE_ARN"]
    sts = boto3.client("sts", region_name=os.environ.get("AWS_REGION", "eu-west-1"))
    response = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="related-posts-atlas",
        DurationSeconds=3600,
    )
    return response["Credentials"]


def _log_assumed_identity(creds: dict) -> None:
    """Emit the assumed-role's STS identity to CloudWatch.

    The printed ARN is the EXACT principal Atlas will receive during the
    MONGODB-AWS handshake. If the federated Atlas database user has a
    different ARN, they will not match. Both success and failure paths log
    with the prefix `Atlas role identity verification:` so the line is
    grep-able regardless of outcome.
    """
    try:
        sts = boto3.client(
            "sts",
            region_name=os.environ.get("AWS_REGION", "eu-west-1"),
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
        )
        identity = sts.get_caller_identity()
        logger.info(
            "Atlas role identity verification: succeeded",
            extra={"arn": identity.get("Arn"), "account": identity.get("Account"), "userId": identity.get("UserId")},
        )
    except Exception as e:  # don't fail the request if diagnostic logging breaks
        logger.warning("Atlas role identity verification: failed", extra={"error": str(e)})


def _client() -> MongoClient:
    now = datetime.now(timezone.utc)
    cached_client = _atlas_state["client"]
    cached_expiry = _atlas_state["creds_expiry"]
    if cached_client is not None and cached_expiry is not None and cached_expiry - now > _CREDS_REFRESH_BUFFER:
        return cached_client

    creds = _assume_atlas_role()
    _log_assumed_identity(creds)
    # authMechanismProperties as a dict (not the colon-separated string form) —
    # avoids a class of parsing edge cases when the session token contains the
    # base64-padding characters `=`, `+`, or `/`.
    client = MongoClient(
        _connection_config()["srvUri"],
        username=creds["AccessKeyId"],
        password=creds["SecretAccessKey"],
        authMechanismProperties={"AWS_SESSION_TOKEN": creds["SessionToken"]},
        serverSelectionTimeoutMS=10_000,
        socketTimeoutMS=10_000,
        connectTimeoutMS=5_000,
        retryReads=False,
        # Pin TLS to certifi's CA bundle. macOS Python (homebrew/pyenv/venv)
        # has an empty default CA store, so without this the backfill script
        # fails locally with CERTIFICATE_VERIFY_FAILED. Lambda's Python
        # already has a correct CA store; passing certifi here is harmless.
        tlsCAFile=certifi.where(),
    )
    _atlas_state["client"] = client
    _atlas_state["creds_expiry"] = creds["Expiration"]
    return client


def _collection():
    cfg = _connection_config()
    return _client()[cfg["db"]][cfg["collection"]]


def find_by_id(slug: str, language: str) -> dict | None:
    return _collection().find_one({"_id": f"{slug}:{language}"}, {"content_hash": 1, "_id": 0})


def find_embedding(slug: str, language: str) -> list[float] | None:
    doc = _collection().find_one(
        {"_id": f"{slug}:{language}"},
        {"_id": 0, "embedding": 1},
    )
    if not doc:
        return None
    return doc.get("embedding")


def find_excerpt(slug: str, language: str = "en", max_chars: int = 1000) -> dict | None:
    doc = _collection().find_one(
        {"_id": f"{slug}:{language}"},
        {"_id": 0, "slug": 1, "title": 1, "body": 1, "tags": 1},
    )
    if not doc:
        return None
    body = doc.get("body", "") or ""
    return {
        "slug": doc["slug"],
        "title": doc.get("title", ""),
        "tags": doc.get("tags", []),
        "excerpt": body[:max_chars],
    }


def upsert_post(doc: dict) -> None:
    """Upsert a fully-formed post document. `_id` is set to '<slug>:<language>'.

    The caller's dict is never mutated; a copy is always taken before defaults are filled.
    """
    doc = dict(doc)
    if "_id" not in doc:
        doc["_id"] = f"{doc['slug']}:{doc['language']}"
    doc.setdefault("embedded_at", datetime.now(timezone.utc).isoformat())
    doc.setdefault("embedding_model", "amazon.titan-embed-text-v2:0")
    _collection().replace_one({"_id": doc["_id"]}, doc, upsert=True)


def vector_search_neighbors(
    embedding: list[float],
    k: int = 10,
    language: str | None = None,
    exclude_slugs: list[str] | None = None,
    index_name: str = "posts_vector_idx",
) -> list[dict]:
    """K nearest neighbors via $vectorSearch.

    The projection is the superset needed by all callers (orchestrator backlink
    lookup wants `language`; the vector-search MCP tool wants `category`).
    """
    search_stage: dict = {
        "index": index_name,
        "path": "embedding",
        "queryVector": embedding,
        "numCandidates": max(100, k * 10),
        "limit": k,
    }
    if language:
        search_stage["filter"] = {"language": language}

    pipeline: list[dict] = [{"$vectorSearch": search_stage}]

    # `slug` is NOT a filter-indexed field, so exclude_slugs stays as a post-stage $match.
    # In practice exclude_slugs is small (typically 1 — the source post itself), so this
    # rarely removes enough candidates to materially affect result size.
    if exclude_slugs:
        pipeline.append({"$match": {"slug": {"$nin": exclude_slugs}}})

    pipeline.append({
        "$project": {
            "_id": 0,
            "slug": 1,
            "language": 1,
            "title": 1,
            "summary": 1,
            "tags": 1,
            "category": 1,
            "score": {"$meta": "vectorSearchScore"},
        }
    })
    return list(_collection().aggregate(pipeline))
