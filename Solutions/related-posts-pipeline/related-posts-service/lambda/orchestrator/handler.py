"""Durable orchestrator for the related-posts pipeline.

Steps (replay-safe; all non-determinism inside context.step / context.invoke):
  1. fetch_source         — Node Lambda, GitHub blob download (cross-Lambda invoke)
  2. content_hash check   — short-circuit if unchanged
  3. embed_post           — Bedrock Titan v2
  4. upsert_post          — Atlas
  5. agent picks primary  — Strands Agent via AgentCore Gateway (child context)
  6. backlink_neighbors   — Atlas k=10 lookup
  7. fan-out recompute    — context.parallel() for top 5 neighbors
  8. persist_dsql         — DELETE+INSERT per affected slug
  9. commit_pr            — Node Lambda durable invoke for GitHub PR

Saga: agent picks count != 3 -> ExecutionError (fail closed, no DSQL/PR write).

Notes on the Python durable SDK (verified against 1.3.0):
  - Handler signature is synchronous: ``def handler(event, context)``.
  - ``context.step(func, name=...)`` returns the step result directly.
  - The step callable receives a ``StepContext`` as its single positional arg.
  - ``ExecutionError`` is exported from ``aws_durable_execution_sdk_python.exceptions``.
  - ``context.invoke(function_name, payload, name=...)`` is the durable
    cross-Lambda call (target must be a durable function with qualified ARN).
    Node Lambdas (fetch_source, commit_pr) are not durable functions, so we
    invoke them via boto3 inside steps instead.
  - ``context.parallel`` and ``context.run_in_child_context`` are the
    fan-out / grouping primitives — no asyncio.
"""
import json
import logging
import os
import uuid
from functools import lru_cache

import boto3
from aws_durable_execution_sdk_python import DurableContext, durable_execution
from aws_durable_execution_sdk_python.config import ParallelConfig
from aws_durable_execution_sdk_python.exceptions import ExecutionError

from agent import pick_related
from atlas_client import find_by_id, upsert_post, vector_search_neighbors
from content_hash import compute_hash, normalize_body
from dsql_writer import Pick, lookup_post_file_path, write_related_posts
from embedding import embed_text
from frontmatter import build_embed_input, parse_frontmatter

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


@lru_cache(maxsize=1)
def _lambda_client():
    return boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "eu-west-1"))


@lru_cache(maxsize=1)
def _events_client():
    return boto3.client("events", region_name=os.environ.get("AWS_REGION", "eu-west-1"))


def emit_related_posts_event(detail_type: str, detail: dict) -> None:
    """Put a lifecycle event on the shared blog-pipeline bus.

    The CMS `related-posts-events` bridge matches `source=blog.related-posts`
    and fans these to AppSync Events so the dashboard can toast + refresh without
    polling. `title` is carried in the Detail so the bridge needs no DB lookup.
    Mirrors the translate-service `blog.translate` event contract.
    """
    _events_client().put_events(
        Entries=[
            {
                "Source": "blog.related-posts",
                "DetailType": detail_type,
                "EventBusName": os.environ["EVENT_BUS_NAME"],
                "Detail": json.dumps(detail),
            }
        ]
    )


def invoke_fetch_source(file_path: str, branch: str, commit_sha: str) -> dict:
    """Synchronously invoke the Node fetch-source Lambda to download the post markdown.

    `file_path` is the full GitHub repo path to the post markdown
    (e.g. `11ty-blog-app/src/posts/2025-02-20-my-post.md`), resolved
    from `cms_content.blog_posts.file_path` via `lookup_post_file_path`
    in a separate durable step before this one is called.

    fetch-source is a regular (non-durable) Node Lambda. We invoke it
    RequestResponse from inside a durable step so the result is checkpointed
    and replay-safe.
    """
    arn = os.environ["FETCH_SOURCE_FUNCTION_ARN"]
    payload = {
        "source": {
            "owner": os.environ["BLOG_REPO_OWNER"],
            "repo": os.environ["BLOG_REPO_NAME"],
            "branch": branch,
            "commitSha": commit_sha,
            "filePath": file_path,
        }
    }
    response = _lambda_client().invoke(
        FunctionName=arn,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    status = response.get("StatusCode")
    raw_payload = response["Payload"].read()
    if status != 200 or response.get("FunctionError"):
        raise RuntimeError(
            f"fetch-source invoke failed: status={status}, "
            f"functionError={response.get('FunctionError')}, "
            f"payload={raw_payload.decode('utf-8', errors='replace')}"
        )
    return json.loads(raw_payload)


def invoke_commit_pr(repo_owner: str, repo_name: str, base_branch: str, title: str, edits: list[dict]) -> dict:
    """Synchronously invoke the Node commit-pr Lambda to open the GitHub PR."""
    arn = os.environ["COMMIT_PR_FUNCTION_ARN"]
    payload = {
        "repo": {"owner": repo_owner, "repo": repo_name, "baseBranch": base_branch},
        "title": title,
        "edits": edits,
    }
    response = _lambda_client().invoke(
        FunctionName=arn,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    status = response.get("StatusCode")
    raw_payload = response["Payload"].read()
    if status != 200 or response.get("FunctionError"):
        raise RuntimeError(
            f"commit-pr invoke failed: status={status}, "
            f"functionError={response.get('FunctionError')}, "
            f"payload={raw_payload.decode('utf-8', errors='replace')}"
        )
    return json.loads(raw_payload)


def _picks_for_one_post(slug: str, title: str, summary: str, language: str) -> list[dict]:
    """Run the agent for one post and return plain dicts.

    We deliberately return JSON-friendly dicts instead of ``dsql_writer.Pick``
    dataclass instances: the durable SDK's default serdes does not support
    arbitrary dataclasses crossing step / child-context boundaries, and step
    return values are checkpointed. Pick instances are reconstructed inside
    ``persist_*_dsql`` steps where they're consumed.
    """
    agent_result = pick_related(
        source_slug=slug,
        source_title=title,
        source_summary=summary,
        language=language,
    )
    return [
        {"slug": p.slug, "rationale": p.rationale, "similarity_score": None}
        for p in agent_result.picks
    ]


def _picks_from_dicts(picks: list[dict]) -> list[Pick]:
    return [Pick(slug=p["slug"], rationale=p["rationale"], similarity_score=p.get("similarity_score")) for p in picks]


def _build_edits(
    primary_file_path: str,
    primary_picks: list[dict],
    backlinks: list[dict],
) -> list[dict]:
    """Construct the file-edit list for commit-pr.

    Backlink entries are silently skipped if they have <3 picks or a missing
    `file_path` (a backlink with no resolvable path is logged elsewhere and
    excluded from the PR rather than failing the whole execution).
    """
    edits = [
        {
            "filePath": primary_file_path,
            "relatedPosts": [{"slug": p["slug"], "rationale": p["rationale"]} for p in primary_picks],
        }
    ]
    for b in backlinks:
        if len(b["picks"]) != 3:
            continue
        if not b.get("file_path"):
            continue
        edits.append(
            {
                "filePath": b["file_path"],
                "relatedPosts": [
                    {"slug": p["slug"], "rationale": p["rationale"]} for p in b["picks"]
                ],
            }
        )
    return edits


@durable_execution
def handler(event: dict, context: DurableContext) -> dict:
    log_event(event, context)
    if "slug" not in event:
        raise ValueError("event must contain 'slug'")

    slug = event["slug"]
    language = event.get("language", "en")
    branch = event.get("branch", "main")
    # commit_sha is optional. A manual re-run from the CMS omits it; we then fetch
    # the branch HEAD (Octokit's repos.getContent accepts a branch name as `ref`).
    # Automatic PostPublished events still pin a SHA for reproducibility.
    commit_sha = event.get("commit_sha")
    git_ref = commit_sha or branch
    # Manual re-runs set force_recompute to bypass the content-hash short-circuit so
    # the agent re-picks even when the post's body is byte-identical to the last run.
    force_recompute = bool(event.get("force_recompute", False))

    # run_id is non-deterministic; compute it inside a step so replays reuse the same value.
    run_id = context.step(lambda _: str(uuid.uuid4()), name="generate_run_id")

    logger.info(
        "orchestrator start",
        extra={
            "slug": slug,
            "language": language,
            "run_id": run_id,
            "git_ref": git_ref,
            "force_recompute": force_recompute,
        },
    )

    # Best-effort title for the RelatedPostsFailed event if we fail before frontmatter parse.
    post_title = ""

    try:
        # 1a. resolve the post's GitHub repo path from cms_content.blog_posts.
        # The CMS stores the canonical full path (e.g. `11ty-blog-app/src/posts/2025-02-20-my-post.md`);
        # constructing it from slug alone is unsafe because filenames carry a date prefix.
        file_path = context.step(
            lambda _: lookup_post_file_path(slug, language),
            name="lookup_file_path",
        )

        # 1b. fetch source markdown by the resolved path (pinned SHA, or branch HEAD on manual re-run).
        fetched = context.step(
            lambda _: invoke_fetch_source(file_path, branch, git_ref),
            name="fetch_source",
        )
        markdown = fetched["markdown"]
        fm, body = parse_frontmatter(markdown)
        post_title = fm.get("title", "")

        # 2. content_hash short-circuit (skipped on a forced manual re-run)
        new_hash = compute_hash(markdown)
        existing = context.step(
            lambda _: find_by_id(slug, language),
            name="find_by_id",
        )
        if not force_recompute and existing and existing.get("content_hash") == new_hash:
            logger.info("content hash unchanged; skipping", extra={"slug": slug, "language": language})
            return {
                "skipped": True,
                "reason": "content_hash_unchanged",
                "slug": slug,
                "language": language,
                "run_id": run_id,
            }

        # 3. embed
        clean_body = normalize_body(markdown)   # strips frontmatter, code fences, image refs
        embed_input = build_embed_input(fm, clean_body)
        embedding = context.step(
            lambda _: embed_text(embed_input),
            name="embed_post",
        )

        # 4. upsert into Atlas
        doc = {
            "slug": slug,
            "language": language,
            "title": fm.get("title", ""),
            "summary": fm.get("description") or fm.get("summary") or "",
            "tags": fm.get("tags") or [],
            "category": fm.get("category", ""),
            "published_at": fm.get("date") or fm.get("published_at", ""),
            "content_hash": new_hash,
            "embedding": embedding,
        }
        context.step(lambda _: upsert_post(doc), name="upsert_post")

        # 5. agent picks for primary post (grouped in a child context — the agent
        # call orchestrates several MCP tool invocations behind the scenes; running
        # it inside a child context keeps the step tree tidy and isolates state
        # tracking from the parent orchestrator).
        primary_picks = context.run_in_child_context(
            lambda child_ctx: child_ctx.step(
                lambda _: _picks_for_one_post(
                    slug=slug,
                    title=doc["title"],
                    summary=doc["summary"],
                    language=language,
                ),
                name="agent_pick_primary",
            ),
            name="primary_agent_picks",
        )
        if len(primary_picks) != 3:
            raise ExecutionError(
                f"Agent returned {len(primary_picks)} picks for primary post, need exactly 3"
            )

        # 6. backlink neighbor lookup
        neighbors = context.step(
            lambda _: vector_search_neighbors(
                embedding=embedding,
                k=10,
                language=language,
                exclude_slugs=[slug],
            ),
            name="find_backlink_candidates",
        )
        backlink_targets = neighbors[:5]

        # 7. fan-out backlink recompute via context.parallel
        backlink_results: list[dict] = []
        if backlink_targets:
            def _make_backlink_fn(neighbor: dict):
                neighbor_slug = neighbor["slug"]
                neighbor_language = neighbor.get("language", language)
                neighbor_title = neighbor.get("title", "")
                neighbor_summary = neighbor.get("summary", "")

                def _fn(parallel_ctx: DurableContext):
                    picks = parallel_ctx.step(
                        lambda _: _picks_for_one_post(
                            slug=neighbor_slug,
                            title=neighbor_title,
                            summary=neighbor_summary,
                            language=neighbor_language,
                        ),
                        name=f"recompute_backlink:{neighbor_slug}",
                    )
                    # Resolve this neighbor's GitHub path so commit-pr can edit it.
                    # Done as its own step so the lookup is checkpointed alongside the picks.
                    # If the neighbor has no row (or NULL file_path), we keep the picks
                    # for DSQL persistence but drop the file from the PR edit list.
                    try:
                        file_path = parallel_ctx.step(
                            lambda _: lookup_post_file_path(neighbor_slug, neighbor_language),
                            name=f"lookup_backlink_file_path:{neighbor_slug}",
                        )
                    except ValueError as e:
                        logger.warning(
                            "backlink missing file_path; excluding from PR but still writing DSQL",
                            extra={"slug": neighbor_slug, "language": neighbor_language, "error": str(e)},
                        )
                        file_path = None
                    return {
                        "slug": neighbor_slug,
                        "language": neighbor_language,
                        "picks": picks,
                        "file_path": file_path,
                    }
                return _fn

            parallel_funcs = [_make_backlink_fn(n) for n in backlink_targets]
            batch = context.parallel(
                parallel_funcs,
                name="backlink_fan_out",
                config=ParallelConfig(max_concurrency=5),
            )
            # Don't fail the whole pipeline if a single backlink agent call fails; just
            # collect the successful results and persist what we have.
            for item in batch.succeeded():
                result = item.result
                if result and len(result.get("picks") or []) == 3:
                    backlink_results.append(result)

        # 8. persist all to DSQL — primary first, then each successful backlink.
        # Reconstruct dsql_writer.Pick dataclasses from the JSON-friendly dicts
        # that were returned from the agent steps.
        context.step(
            lambda _: write_related_posts(
                source_slug=slug,
                language=language,
                picks=_picks_from_dicts(primary_picks),
                run_id=run_id,
            ),
            name="persist_primary_dsql",
        )
        for b in backlink_results:
            # Closure-over-loop-var fix: bind b through a default kwarg in the lambda.
            context.step(
                lambda _, bb=b: write_related_posts(
                    source_slug=bb["slug"],
                    language=bb["language"],
                    picks=_picks_from_dicts(bb["picks"]),
                    run_id=run_id,
                ),
                name=f"persist_backlink_dsql:{b['slug']}",
            )

        # 9. open the PR
        edits = _build_edits(file_path, primary_picks, backlink_results)
        pr = context.step(
            lambda _: invoke_commit_pr(
                repo_owner=os.environ["BLOG_REPO_OWNER"],
                repo_name=os.environ["BLOG_REPO_NAME"],
                base_branch=branch,
                title=f"chore(related-posts): refresh for {slug}",
                edits=edits,
            ),
            name="invoke_commit_pr",
        )

        logger.info(
            "backlink fan-out complete",
            extra={"slug": slug, "run_id": run_id, "backlink_count": len(backlink_results)},
        )

        # 10. notify the CMS (toast + auto-refresh) via the shared bus → AppSync bridge.
        context.step(
            lambda _: emit_related_posts_event(
                "RelatedPostsCompleted",
                {
                    "slug": slug,
                    "language": language,
                    "title": doc["title"],
                    "run_id": run_id,
                    "pick_count": len(primary_picks),
                    "backlink_count": len(backlink_results),
                    "pr_url": pr.get("prUrl") if isinstance(pr, dict) else None,
                },
            ),
            name="emit_completed",
        )

        return {
            "run_id": run_id,
            "primary": {
                "slug": slug,
                "language": language,
                "related": [{"slug": p["slug"], "rationale": p["rationale"]} for p in primary_picks],
            },
            "backlinks": [
                {
                    "slug": b["slug"],
                    "language": b["language"],
                    "related": [{"slug": p["slug"], "rationale": p["rationale"]} for p in b["picks"]],
                }
                for b in backlink_results
            ],
            "pr": pr,
        }

    except Exception as exc:
        # Fail-closed paths (e.g. <3 picks) and any unrecoverable error notify the CMS
        # so the dashboard can surface an error toast. Emitting is itself a checkpointed
        # step; we re-raise so the durable execution is still marked failed.
        logger.exception("related-posts orchestration failed", extra={"slug": slug, "run_id": run_id})
        context.step(
            lambda _, msg=str(exc): emit_related_posts_event(
                "RelatedPostsFailed",
                {
                    "slug": slug,
                    "language": language,
                    "title": post_title,
                    "run_id": run_id,
                    "error": msg,
                },
            ),
            name="emit_failed",
        )
        raise
