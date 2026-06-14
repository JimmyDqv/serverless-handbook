-- Minimal DSQL schema required by the related-posts pipeline.
-- Run against your Amazon DSQL cluster (psql or your own migration tooling).
--
-- DSQL gotcha: ALTER TABLE ADD COLUMN only accepts `column_name data_type`
-- (no NOT NULL / DEFAULT / CHECK after creation) — define constraints up front.

CREATE SCHEMA IF NOT EXISTS cms_content;

-- The pipeline READS this table to resolve a post's path in the GitHub repo.
-- If you already have a posts table, you only need these two columns; adapt
-- lookup_post_file_path() in lambda/orchestrator/dsql_writer.py to match.
-- file_path is the full repo path (e.g. 'src/posts/2025-02-20-my-post.md') —
-- it is never constructed from the slug (filenames often carry date prefixes).
CREATE TABLE IF NOT EXISTS cms_content.blog_posts (
    page_slug  TEXT NOT NULL,
    file_path  TEXT,
    PRIMARY KEY (page_slug)
);

-- The pipeline WRITES the agent's picks here (DELETE + INSERT per post, one
-- transaction). This is the source of truth; the GitHub PR is the snapshot
-- your static site renders.
CREATE TABLE IF NOT EXISTS cms_content.related_posts (
    source_slug      TEXT NOT NULL,
    language         TEXT NOT NULL,
    position         SMALLINT NOT NULL,    -- 1, 2, 3
    related_slug     TEXT NOT NULL,
    rationale        TEXT NOT NULL,
    similarity_score DOUBLE PRECISION,
    run_id           UUID NOT NULL,
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_slug, language, position),
    CHECK (position BETWEEN 1 AND 3)
);
