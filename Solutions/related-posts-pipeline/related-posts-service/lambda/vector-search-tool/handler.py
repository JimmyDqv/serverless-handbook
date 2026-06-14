"""MCP tool — $vectorSearch over the posts collection.

This handler implements the AgentCore Gateway MCP Lambda target contract:
the gateway passes the tool's input JSON as the Lambda event; the return
value JSON is the tool's output.

The tool takes a `source_slug` (+ optional `language`), looks up that post's
stored 1024-dim Titan v2 embedding from Atlas, and uses it as the query
vector. The agent never handles the raw embedding — that decoupling is what
prevents the agent from fabricating a wrong-shape vector and blowing up at
the Atlas index boundary.
"""
import json
import logging
import os

from atlas_client import find_embedding, vector_search_neighbors

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

_EXPECTED_DIMS = 1024


def log_event(event, context=None) -> None:
    """Always print the incoming event, regardless of LOG_LEVEL."""
    print(json.dumps({
        "level": "INFO",
        "message": "incoming event",
        "event": event,
        "requestId": getattr(context, "aws_request_id", None),
    }, default=str))


def handler(event: dict, context) -> dict:
    log_event(event, context)
    source_slug = event.get("source_slug")
    if not source_slug:
        raise ValueError("Required field 'source_slug' missing from tool input")
    language = event.get("language") or "en"

    embedding = find_embedding(source_slug, language)
    if embedding is None:
        raise ValueError(
            f"source post not found in corpus: {source_slug}:{language} "
            "(the orchestrator should have upserted it before invoking the agent)"
        )
    if len(embedding) != _EXPECTED_DIMS:
        raise ValueError(
            f"stored embedding for {source_slug}:{language} has "
            f"{len(embedding)} dimensions, expected {_EXPECTED_DIMS}"
        )

    raw_k = event.get("k", 20)
    try:
        k = int(raw_k)
    except (TypeError, ValueError):
        raise ValueError(f"'k' must be an integer, got: {raw_k!r}")
    exclude = event.get("exclude_slugs")

    logger.info(
        "vector_search invoke",
        extra={"source_slug": source_slug, "language": language, "k": k, "dims": len(embedding)},
    )

    candidates = vector_search_neighbors(
        embedding=embedding,
        k=k,
        language=language,
        exclude_slugs=exclude,
    )
    logger.info("vector_search result", extra={"source_slug": source_slug, "candidate_count": len(candidates)})
    return {"candidates": candidates, "count": len(candidates)}
