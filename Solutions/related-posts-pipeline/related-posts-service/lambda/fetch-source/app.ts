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
  const secretArn = process.env.GITHUB_SECRET_ARN;
  if (!secretArn) throw new Error("GITHUB_SECRET_ARN env var missing");
  const res = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!res.SecretString) throw new Error("Secret has no SecretString");
  const parsed = JSON.parse(res.SecretString) as { token?: string };
  if (!parsed.token) throw new Error("Secret missing 'token' key");
  cachedToken = parsed.token;
  return cachedToken;
}

export interface FetchSourceInput {
  source: {
    owner: string;
    repo: string;
    branch: string;
    commitSha: string;
    filePath: string;
  };
}

export interface FetchSourceOutput {
  markdown: string;
  sha: string;
}

export const handler = async (event: FetchSourceInput): Promise<FetchSourceOutput> => {
  logEvent(event);
  log("INFO", "fetch-source invoked", {
    owner: event.source.owner,
    repo: event.source.repo,
    commitSha: event.source.commitSha,
    filePath: event.source.filePath,
  });
  const token = await getGitHubToken();
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.getContent({
    owner: event.source.owner,
    repo: event.source.repo,
    path: event.source.filePath,
    ref: event.source.commitSha,
  });

  if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
    throw new Error(`Expected file at ${event.source.filePath}`);
  }
  if (data.encoding !== "base64") {
    throw new Error(`Unexpected GitHub content encoding: ${data.encoding}`);
  }
  const markdown = Buffer.from(data.content, "base64").toString("utf-8");
  log("INFO", "fetch-source done", { filePath: event.source.filePath, bytes: markdown.length, sha: data.sha });

  return { markdown, sha: data.sha };
};
