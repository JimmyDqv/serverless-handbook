"""YAML frontmatter parsing and embedding-input construction."""
import re

import yaml

_FRONTMATTER_RE = re.compile(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$", re.MULTILINE)


def parse_frontmatter(markdown: str) -> tuple[dict, str]:
    m = _FRONTMATTER_RE.match(markdown)
    if not m:
        raise ValueError("Markdown has no YAML frontmatter")
    fm = yaml.safe_load(m.group(1)) or {}
    if not isinstance(fm, dict):
        raise ValueError("Frontmatter is not a mapping")
    return fm, m.group(2)


def build_embed_input(frontmatter: dict, body: str, max_chars: int = 30_000) -> str:
    title = frontmatter.get("title", "")
    tags = frontmatter.get("tags") or []
    if isinstance(tags, list):
        tags_str = ", ".join(str(t) for t in tags)
    else:
        tags_str = str(tags)
    summary = frontmatter.get("description") or frontmatter.get("summary") or ""
    text = f"TITLE: {title}\nTAGS: {tags_str}\nSUMMARY: {summary}\n\n{body}".strip()
    return text[:max_chars]
