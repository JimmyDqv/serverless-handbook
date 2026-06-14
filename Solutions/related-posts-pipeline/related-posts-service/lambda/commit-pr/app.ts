import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Octokit } from "@octokit/rest";

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 } as const;
type Level = keyof typeof LEVELS;
const threshold = LEVELS[(process.env.LOG_LEVEL ?? "INFO") as Level] ?? 20;

function log(level: Level, message: string, data?: object): void {
  if (LEVELS[level] >= threshold) console.log(JSON.stringify({ level, message, ...data }));
}

function logEvent(event: unknown): void {
  // Always printed, regardless of LOG_LEVEL.
  console.log(JSON.stringify({ level: "INFO", message: "incoming event", event }));
}

const secrets = new SecretsManagerClient({});

let cachedToken: string | undefined;
async function getGitHubToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const arn = process.env.GITHUB_SECRET_ARN;
  if (!arn) throw new Error("GITHUB_SECRET_ARN env var missing");
  const res = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) throw new Error("Secret has no SecretString");
  const parsed = JSON.parse(res.SecretString) as { token?: string };
  if (!parsed.token) throw new Error("Secret missing 'token' key");
  cachedToken = parsed.token;
  return cachedToken;
}

export interface RelatedPick {
  slug: string;
  rationale: string;
}

export interface FileEdit {
  filePath: string;
  relatedPosts: RelatedPick[];
}

export interface CommitPRInput {
  repo: { owner: string; repo: string; baseBranch: string };
  title: string;
  edits: FileEdit[];
}

export interface CommitPROutput {
  prUrl: string;
  prNumber: number;
  branch: string;
}

function injectRelatedPosts(markdown: string, picks: RelatedPick[]): string {
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) throw new Error("Markdown has no YAML frontmatter");
  const [, fm, body] = fmMatch;
  const lines = fm.split(/\r?\n/);
  const filtered: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (line.startsWith("related_posts:")) { skipping = true; continue; }
    if (skipping && /^[a-zA-Z0-9_]/.test(line)) skipping = false;
    if (!skipping) filtered.push(line);
  }
  const trimmed = filtered.filter((l, i, a) => !(l === "" && i === a.length - 1)).join("\n");
  const related = [
    "related_posts:",
    ...picks.flatMap((p) => [
      `  - slug: ${JSON.stringify(p.slug)}`,
      `    rationale: ${JSON.stringify(p.rationale)}`,
    ]),
  ].join("\n");
  return `---\n${trimmed}\n${related}\n---\n${body}`;
}

export const handler = async (event: CommitPRInput): Promise<CommitPROutput> => {
  logEvent(event);
  log("INFO", "commit-pr invoked", {
    owner: event.repo.owner,
    repo: event.repo.repo,
    baseBranch: event.repo.baseBranch,
    editsCount: event.edits.length,
    title: event.title,
  });

  const token = await getGitHubToken();
  const octokit = new Octokit({ auth: token });
  const { owner, repo, baseBranch } = event.repo;

  const slugFromPath = event.edits[0].filePath.split("/").pop()!.replace(/\.md$/, "");
  const branch = `related-posts/${slugFromPath}`;

  const baseRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseRef.data.object.sha,
    });
  } catch (e: unknown) {
    const e422 = e as { status?: number; message?: string };
    if (e422.status !== 422 || !/already exists/i.test(e422.message ?? "")) throw e;
    log("INFO", "branch already exists, reusing", { branch });
  }

  let anyWritten = false;
  for (const edit of event.edits) {
    const existing = await octokit.rest.repos.getContent({ owner, repo, path: edit.filePath, ref: branch });
    if (Array.isArray(existing.data) || existing.data.type !== "file" || !("content" in existing.data)) {
      throw new Error(`Expected file at ${edit.filePath}`);
    }
    if (existing.data.encoding !== "base64") {
      throw new Error(`Unexpected GitHub content encoding: ${existing.data.encoding}`);
    }
    const current = Buffer.from(existing.data.content, "base64").toString("utf-8");
    const updated = injectRelatedPosts(current, edit.relatedPosts);
    if (updated === current) continue;
    anyWritten = true;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: edit.filePath,
      message: `chore(related-posts): update ${edit.filePath}`,
      content: Buffer.from(updated, "utf-8").toString("base64"),
      branch,
      sha: existing.data.sha,
    });
  }

  if (!anyWritten) {
    log("INFO", "all files already up to date, skipping PR creation", { branch });
    return { prUrl: "", prNumber: 0, branch };
  }

  const existing = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: "open",
  });
  if (existing.data.length > 0) {
    const existingPr = existing.data[0];
    log("INFO", "PR already exists, returning existing", { url: existingPr.html_url, number: existingPr.number });
    return { prUrl: existingPr.html_url, prNumber: existingPr.number, branch };
  }

  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    title: event.title,
    head: branch,
    base: baseBranch,
    body: `Auto-generated by related-posts-service. ${event.edits.length} file(s) updated.`,
  });

  log("INFO", "PR opened", { url: pr.data.html_url, number: pr.data.number, branch });

  return { prUrl: pr.data.html_url, prNumber: pr.data.number, branch };
};
