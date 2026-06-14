"""MCP tool — read first N chars of a post body for agent disambiguation."""
import json
import logging
import os

from atlas_client import find_excerpt

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


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
    if "slug" not in event:
        raise ValueError("Required field 'slug' missing from tool input")
    slug = event["slug"]
    language = event.get("language", "en")
    raw_max_chars = event.get("max_chars", 1000)
    try:
        max_chars = int(raw_max_chars)
    except (TypeError, ValueError):
        raise ValueError(f"'max_chars' must be an integer, got: {raw_max_chars!r}")
    result = find_excerpt(slug=slug, language=language, max_chars=max_chars)
    if result is None:
        logger.info("excerpt not found", extra={"slug": slug, "language": language})
        return {"error": "not_found", "slug": slug}
    logger.info("excerpt hit", extra={"slug": slug, "language": language, "chars": len(result.get("excerpt", ""))})
    return result
