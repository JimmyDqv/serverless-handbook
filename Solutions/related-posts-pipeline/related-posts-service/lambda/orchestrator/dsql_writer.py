"""DSQL access for cms_content tables.

Writes for `cms_content.related_posts` are DELETE-then-INSERT inside ONE transaction
on a single connection so re-runs are idempotent and a partial INSERT failure leaves
the table unchanged (DELETE rolls back).

Reads for `cms_content.blog_posts.file_path` resolve the canonical GitHub repo path
for a post (e.g. `src/posts/2025-02-20-my-post.md`) — populated by whatever
system owns your blog_posts table (see database/schema.sql).
"""
import os
from dataclasses import dataclass

from dsql import DSQLConnector


@dataclass
class Pick:
    slug: str
    rationale: str
    similarity_score: float | None


def _derive_translated_path(english_path: str, language: str) -> str:
    """Insert `/{language}/` between the directory and the basename of a posts path.

    English `11ty-blog-app/src/posts/2025-02-20-my-post.md`
      → Spanish `11ty-blog-app/src/posts/es/2025-02-20-my-post.md`

    Matches the convention in translate-service's `translate-markdown` handler
    (`f"11ty-blog-app/src/posts/{target_language}/{filename}"`), but written
    generically by splitting on the last `/` so it survives renames of the
    parent directory.
    """
    if "/" not in english_path:
        raise ValueError(f"Cannot derive translated path from {english_path!r}: no directory segment")
    directory, _, filename = english_path.rpartition("/")
    return f"{directory}/{language}/{filename}"


def lookup_post_file_path(page_slug: str, language: str = "en") -> str:
    """Resolve the GitHub repo path of a post from cms_content.blog_posts.

    The `blog_posts` table holds ONE row per post keyed by `page_slug` (unique
    index). The stored `file_path` is the English source path. Translated
    variants do not have their own rows in `blog_posts` — their paths are
    derived by inserting the language code into the canonical English path.

    Raises ValueError if no row exists for `page_slug` or if `file_path` is
    NULL (legacy row — backfill file_path before running the pipeline for it).
    """
    endpoint = os.environ["DSQL_CLUSTER_ENDPOINT"]
    role = os.environ["DATABASE_WRITER_ROLE"]
    user = os.environ["DATABASE_USER"]
    region = os.environ.get("AWS_REGION", "eu-west-1")

    connector = DSQLConnector(endpoint, region)
    token = connector.assume_role_and_get_token(role, session_name="related-posts-writer")
    rows = connector.execute_query(
        token,
        user,
        "SELECT file_path FROM cms_content.blog_posts WHERE page_slug = %(page_slug)s",
        {"page_slug": page_slug},
    )
    if not rows:
        raise ValueError(f"No blog_posts row for page_slug={page_slug!r}")
    english_path = rows[0]["file_path"]
    if not english_path:
        raise ValueError(
            f"blog_posts row for page_slug={page_slug!r} has NULL file_path "
            "(backfill file_path before running the pipeline for this post)"
        )
    if language == "en":
        return english_path
    return _derive_translated_path(english_path, language)


def write_related_posts(
    source_slug: str,
    language: str,
    picks: list[Pick],
    run_id: str,
) -> None:
    endpoint = os.environ["DSQL_CLUSTER_ENDPOINT"]
    role = os.environ["DATABASE_WRITER_ROLE"]
    user = os.environ["DATABASE_USER"]
    region = os.environ.get("AWS_REGION", "eu-west-1")

    connector = DSQLConnector(endpoint, region)
    token = connector.assume_role_and_get_token(role, session_name="related-posts-writer")

    conn = connector.get_connection(token, user)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM cms_content.related_posts "
                "WHERE source_slug = %(s)s AND language = %(l)s",
                {"s": source_slug, "l": language},
            )
            for position, pick in enumerate(picks, start=1):
                cur.execute(
                    """
                    INSERT INTO cms_content.related_posts
                        (source_slug, language, position, related_slug, rationale, similarity_score, run_id)
                    VALUES (%(src)s, %(lang)s, %(pos)s, %(rel)s, %(rat)s, %(sim)s, %(run)s)
                    """,
                    {
                        "src": source_slug,
                        "lang": language,
                        "pos": position,
                        "rel": pick.slug,
                        "rat": pick.rationale,
                        "sim": pick.similarity_score,
                        "run": run_id,
                    },
                )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
