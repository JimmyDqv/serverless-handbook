"""Stable content hash over normalized post body (frontmatter excluded)."""
import hashlib
import re

from frontmatter import parse_frontmatter

_FENCE_RE = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")


def normalize_body(markdown: str) -> str:
    """Strip frontmatter, code fences, and image refs; return the trimmed remainder.

    Raises ValueError if the markdown has no frontmatter (callers fetch posts that always have one).
    """
    _, body = parse_frontmatter(markdown)
    body = _FENCE_RE.sub("", body)
    body = _IMG_RE.sub("", body)
    return body.strip()


def compute_hash(markdown: str) -> str:
    return "sha256:" + hashlib.sha256(normalize_body(markdown).encode("utf-8")).hexdigest()
