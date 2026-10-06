/**
 * Opens a pull request for a page approval through the GitHub REST API, so the review flag (and any edits the
 * attorney made in the portal) land in git and go through CI like every other change. One PR per approval.
 * It never merges: a person merges the PR after CI passes.
 *
 * Env: GITHUB_CONTENT_TOKEN (fine-grained token with contents and pull requests write on the repo),
 * GITHUB_CONTENT_REPO (default mailangad88/estateplanning), GITHUB_CONTENT_BASE (default main).
 * Without a token nothing is sent and approvals wait for `npm run review:apply`.
 */
import { createHash } from "node:crypto";

export interface GithubConfig {
  token: string;
  repo: string;
  base: string;
  api: string;
}

export function githubConfig(env: NodeJS.ProcessEnv = process.env): GithubConfig | null {
  const token = env.GITHUB_CONTENT_TOKEN?.trim();
  if (!token) return null;
  return {
    token,
    repo: env.GITHUB_CONTENT_REPO?.trim() || "mailangad88/estateplanning",
    base: env.GITHUB_CONTENT_BASE?.trim() || "main",
    api: "https://api.github.com",
  };
}

export interface PullRequestInput {
  branch: string;
  title: string;
  body: string;
  message: string;
  author: { name: string; email: string; date: string };
  /** Each file as it reads on the base branch now (its sha256 must equal `expectedHash`) and its new text. */
  files: { path: string; expectedHash: string; content: string }[];
}

export interface PullRequestResult {
  url: string;
  number: number;
  branch: string;
}

export class GithubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubError";
  }
}

type Fetch = typeof fetch;

export async function openApprovalPullRequest(cfg: GithubConfig, input: PullRequestInput, fetchImpl: Fetch = fetch): Promise<PullRequestResult> {
  const call = async <T>(method: string, route: string, body?: unknown): Promise<T> => {
    const res = await fetchImpl(`${cfg.api}/repos/${cfg.repo}${route}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${cfg.token}`,
        "x-github-api-version": "2022-11-28",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new GithubError(`GitHub ${method} ${route} failed (${res.status}): ${json.message ?? "no message"}`);
    return json;
  };
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

  const ref = await call<{ object: { sha: string } }>("GET", `/git/ref/heads/${enc(cfg.base)}`);
  const baseSha = ref.object.sha;

  // The PR must change the file the attorney read. If the base branch has a newer version, stop.
  for (const f of input.files) {
    const current = await call<{ content?: string; encoding?: string }>("GET", `/contents/${enc(f.path)}?ref=${encodeURIComponent(baseSha)}`);
    const bytes = Buffer.from(current.content ?? "", current.encoding === "base64" ? "base64" : "utf8");
    if (createHash("sha256").update(bytes).digest("hex") !== f.expectedHash) {
      throw new GithubError(`${f.path} on ${cfg.base} is not the version you reviewed (a newer edit is waiting to deploy). Reload after the deploy and review it again.`);
    }
  }

  const baseCommit = await call<{ tree: { sha: string } }>("GET", `/git/commits/${baseSha}`);
  const tree = await call<{ sha: string }>("POST", "/git/trees", {
    base_tree: baseCommit.tree.sha,
    tree: input.files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
  });
  const commit = await call<{ sha: string }>("POST", "/git/commits", {
    message: input.message,
    tree: tree.sha,
    parents: [baseSha],
    author: input.author,
  });
  await call("POST", "/git/refs", { ref: `refs/heads/${input.branch}`, sha: commit.sha });
  const pr = await call<{ html_url: string; number: number }>("POST", "/pulls", {
    title: input.title,
    head: input.branch,
    base: cfg.base,
    body: input.body,
  });
  return { url: pr.html_url, number: pr.number, branch: input.branch };
}
