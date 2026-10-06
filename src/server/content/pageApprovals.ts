/**
 * Page approvals: the attorney's sign-off that a site page may be published (docs/content-pipeline.md section 7).
 *
 * Every approval is recorded (append-only, like template_approvals) and bound to the sha256 of the content file
 * the attorney read. Content files live in git, so the flag has to land there too:
 *   - with GITHUB_CONTENT_TOKEN set, each approval opens one pull request that sets `review: approved` or
 *     `reviewed: true` (plus reviewedBy and lastReviewed) and carries any edits made in the portal; CI checks
 *     it and a person merges it. Nothing here merges.
 *   - without it, the approval is recorded only and `npm run review:apply` writes the flags later.
 *
 * The risk tier from src/lib/review-queue.ts decides how pages may be grouped, never whether they are approved:
 *   low            batches of up to 20 (shown in tens)
 *   medium, high   one page at a time, with the option to edit it before approving
 * Nothing here approves anything on its own. Every approval is a request from a signed-in attorney.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { audit } from "@/server/audit/log";
import { assertCan, can, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import type { Actor, PageApproval } from "@/server/types";
import { fileFor, reviewQueue, type ReviewItem, type RiskTier } from "@/lib/review-queue";
import { applyEdits, editableParts, flagFor, withReviewFlags, type EditableParts } from "@/lib/review-flags";
import { githubConfig, openApprovalPullRequest, type GithubConfig } from "@/server/content/githubPublish";
import { render as renderContent } from "@/lib/content";
import { render as renderLibrary } from "@/lib/library";

/** Most pages one approval may cover, per tier. Enforced on the server, whatever the browser sends. */
export const BATCH_LIMIT: Record<RiskTier, number> = { low: 20, medium: 1, high: 1 };
/** How the portal groups pages for review. */
export const BATCH_SIZE: Record<RiskTier, number> = { low: 10, medium: 1, high: 1 };
/** Largest edited page the portal accepts. */
const MAX_EDIT_BYTES = 200_000;

export interface PageSource {
  /** Repo root the content files are read from. */
  root: string;
  /** Every page that needs (or has had) the attorney's sign-off, highest search value first. */
  items(): ReviewItem[];
}

export const repoPages: PageSource = {
  root: process.cwd(),
  items: () => reviewQueue({ includeReviewed: true }),
};

export interface PublishDeps {
  github?: GithubConfig | null;
  fetch?: typeof fetch;
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

/** sha256 of the content file's bytes, or null when the file is missing. */
export function fileHash(root: string, file: string): string | null {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return sha256(fs.readFileSync(full));
}

// ---------- Status ----------

/**
 * - published: the content file already carries the review flag
 * - approved: you approved the file as it reads now (or edited it and the edit waits in a pull request)
 * - changed: you approved an earlier version of the file; it needs a new look
 * - pending: never approved
 */
export type PageStatus = "published" | "approved" | "changed" | "pending";

export interface PageRow extends ReviewItem {
  file: string;
  hash: string | null;
  status: PageStatus;
  /** The approval covering the file as it reads now. */
  approval?: PageApproval;
  /** The newest approval of any version of this page. */
  latest?: PageApproval;
  /** The Pangram note from the review queue, when the page reads mostly AI-written. */
  aiFlag?: string;
}

function newest(list: PageApproval[]): PageApproval | undefined {
  let best: PageApproval | undefined;
  for (const a of list) if (!best || a.approvedAt > best.approvedAt) best = a;
  return best;
}

/** An approval covers the file if it approved these exact bytes, or edits made on top of them. */
const covers = (a: PageApproval, hash: string | null) => hash !== null && (a.contentHash === hash || a.editedFromHash === hash);

export function pageRows(items: ReviewItem[], approvals: PageApproval[], root: string): PageRow[] {
  const byPath = new Map<string, PageApproval[]>();
  for (const a of approvals) byPath.set(a.path, [...(byPath.get(a.path) ?? []), a]);
  return items.map((item) => {
    const file = fileFor(item.path);
    const hash = fileHash(root, file);
    const mine = byPath.get(item.path) ?? [];
    const approval = newest(mine.filter((a) => covers(a, hash)));
    const latest = newest(mine);
    const status: PageStatus = item.reviewed ? "published" : approval ? "approved" : latest ? "changed" : "pending";
    const aiFlag = item.reasons.find((r) => r.includes("AI-written"));
    return { ...item, file, hash, status, approval, latest, aiFlag };
  });
}

export interface PageQueue {
  rows: PageRow[];
  counts: {
    tiers: Record<RiskTier, number>;
    status: Record<PageStatus, number>;
  };
  /** Pages still to review (pending or changed), grouped by tier into approvable batches. Changed pages first. */
  batches: Record<RiskTier, PageRow[][]>;
  /** True when approvals open a pull request; false when they wait for `npm run review:apply`. */
  opensPullRequests: boolean;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function assertReviewer(actor: Actor, message: string) {
  assertCan(can(actor, "approve_pages"), message);
  requireMfa(actor);
}

export async function listPageQueue(db: Db, actor: Actor, source: PageSource = repoPages, deps: PublishDeps = {}): Promise<PageQueue> {
  assertReviewer(actor, "Only attorneys and platform admins can review pages");
  const rows = pageRows(source.items(), await db.pageApprovals.list(), source.root);
  const tiers: Record<RiskTier, number> = { low: 0, medium: 0, high: 0 };
  const status: Record<PageStatus, number> = { published: 0, approved: 0, changed: 0, pending: 0 };
  for (const r of rows) {
    status[r.status]++;
    if (r.status === "pending" || r.status === "changed") tiers[r.tier]++;
  }
  const open = (t: RiskTier) => {
    const list = rows.filter((r) => r.tier === t && (r.status === "pending" || r.status === "changed") && r.hash);
    return [...list.filter((r) => r.status === "changed"), ...list.filter((r) => r.status === "pending")];
  };
  const batches = {
    low: chunk(open("low"), BATCH_SIZE.low),
    medium: chunk(open("medium"), BATCH_SIZE.medium),
    high: chunk(open("high"), BATCH_SIZE.high),
  };
  const github = deps.github === undefined ? githubConfig() : deps.github;
  return { rows, counts: { tiers, status }, batches, opensPullRequests: !!github };
}

// ---------- Editor ----------

export interface PageSourceText extends EditableParts {
  path: string;
  hash: string;
}

/** The editable parts of one page, for the inline editor. */
export async function readPageForEdit(db: Db, actor: Actor, pagePath: string, source: PageSource = repoPages): Promise<PageSourceText> {
  assertReviewer(actor, "Only attorneys and platform admins can edit pages for review");
  const item = source.items().find((i) => i.path === pagePath);
  if (!item) throw new Error(`Unknown page: ${pagePath}`);
  const file = fileFor(item.path);
  const full = path.join(source.root, file);
  if (!fs.existsSync(full)) throw new Error(`${pagePath} has no content file`);
  const raw = fs.readFileSync(full);
  return { path: item.path, hash: sha256(raw), ...editableParts(raw.toString("utf8")) };
}

// ---------- Approving ----------

export interface ApprovePagesInput {
  /** Each page with the content hash the attorney was shown. */
  pages: { path: string; contentHash: string }[];
  /** The attorney ticked "I read each page in this batch" (or "I read this page"). */
  confirmed: boolean;
  note?: string;
  /** Edits made in the portal editor. One page only, and only when approvals open pull requests. */
  edits?: EditableParts;
}

export interface ApprovePagesResult {
  batchId: string;
  tier: RiskTier;
  approvals: PageApproval[];
  /** The pull request that carries the approval into git, or null when it waits for `npm run review:apply`. */
  pullRequest: { url: string; number: number; branch: string } | null;
}

function prBody(rows: { title: string; path: string; file: string; edited: boolean }[], tier: RiskTier, who: string, date: string, note: string, ids: string[], batchId: string): string {
  return [
    `Approved in the attorney portal (/portal/pages) by ${who} on ${date}.`,
    "",
    `Risk tier: ${tier}`,
    "",
    "Pages:",
    ...rows.map((r) => `- ${r.title} (\`${r.path}\`, ${r.file})${r.edited ? ", edited by the attorney in the portal" : ""}`),
    "",
    `Attorney's note: ${note || "(none)"}`,
    "",
    `Batch: ${batchId}`,
    `Approval ids: ${ids.join(", ")}`,
    "",
    "Each approval is bound to the sha256 of the file the attorney read; the portal checked the file on the base branch still matches. Merge once CI passes. This pull request was not and will not be merged automatically.",
  ].join("\n");
}

export async function approvePages(
  db: Db,
  actor: Actor,
  input: ApprovePagesInput,
  source: PageSource = repoPages,
  now = new Date(),
  deps: PublishDeps = {},
): Promise<ApprovePagesResult> {
  assertReviewer(actor, "Only attorneys and platform admins can approve pages");
  if (input.confirmed !== true) throw new Error("Confirm that you read each page before approving");
  const pages = Array.isArray(input.pages) ? input.pages : [];
  if (pages.length === 0) throw new Error("Pick at least one page");
  const paths = pages.map((p) => String(p.path));
  if (new Set(paths).size !== paths.length) throw new Error("A page is listed twice");
  const github = deps.github === undefined ? githubConfig() : deps.github;

  const rows = new Map(pageRows(source.items(), await db.pageApprovals.list(), source.root).map((r) => [r.path, r]));
  const picked = pages.map((p) => {
    const row = rows.get(String(p.path));
    if (!row) throw new Error(`Unknown page: ${p.path}`);
    if (row.status === "published") throw new Error(`${row.path} is already published`);
    if (!row.hash) throw new Error(`${row.path} has no content file`);
    if (String(p.contentHash) !== row.hash) {
      throw new Error(`${row.path} changed while you were reviewing it. Reload and read the new version.`);
    }
    if (row.status === "approved") throw new Error(`${row.path} is already approved as it reads now`);
    if (!flagFor(row.file)) throw new Error(`${row.path} has no review flag to set`);
    return row;
  });

  const tiers = new Set(picked.map((r) => r.tier));
  if (tiers.size !== 1) throw new Error("Approve one risk tier at a time");
  const tier = picked[0].tier;
  if (tier !== "low" && picked.length > 1) throw new Error(`${tier === "high" ? "High" : "Medium"}-risk pages are approved one at a time`);
  if (picked.length > BATCH_LIMIT[tier]) throw new Error(`At most ${BATCH_LIMIT[tier]} ${tier}-risk pages per approval`);

  // The file text each approval covers: as read, or with the attorney's edits.
  const texts = picked.map((row) => fs.readFileSync(path.join(source.root, row.file), "utf8"));
  let edited: string | null = null;
  if (input.edits) {
    if (picked.length !== 1) throw new Error("Edits can be made one page at a time");
    if (!github) throw new Error("Editing in the portal needs GitHub publishing (GITHUB_CONTENT_TOKEN). Approve the page as it reads, or ask for the edit in the repo.");
    edited = applyEdits(texts[0], {
      title: String(input.edits.title ?? ""),
      description: String(input.edits.description ?? ""),
      body: String(input.edits.body ?? ""),
    });
    if (Buffer.byteLength(edited) > MAX_EDIT_BYTES) throw new Error("That page is too long to edit here");
    if (edited === texts[0]) edited = null; // nothing changed: a plain approval
  }

  const user = await db.users.get(actor.userId);
  const approverName = user?.name ?? actor.userId;
  const batchId = `batch_${randomUUID()}`;
  const note = String(input.note ?? "").trim().slice(0, 2000);
  const date = now.toISOString();
  const records: PageApproval[] = picked.map((row, i) => ({
    id: `pa_${randomUUID()}`,
    path: row.path,
    file: row.file,
    contentHash: i === 0 && edited !== null ? sha256(edited) : row.hash!,
    tier,
    approvedBy: actor.userId,
    approverRole: actor.role,
    approverName,
    approvedAt: date,
    note,
    batchId,
    ...(i === 0 && edited !== null ? { editedFromHash: row.hash! } : {}),
  }));

  // Only an attorney's approval goes into the files; a platform admin's is recorded, not published.
  let pullRequest: ApprovePagesResult["pullRequest"] = null;
  if (github && actor.role === "attorney") {
    const ids = records.map((r) => r.id);
    const count = picked.length === 1 ? `${picked[0].title}` : `${picked.length} ${tier}-risk pages`;
    pullRequest = await openApprovalPullRequest(
      github,
      {
        branch: `page-approval/${batchId}`,
        title: `Attorney approval: ${count}`,
        message: [
          `Approve ${picked.length === 1 ? picked[0].path : `${picked.length} ${tier}-risk pages`} for publication`,
          "",
          `Approved by ${approverName} in the attorney portal on ${date.slice(0, 10)}${edited !== null ? ", with edits made in the portal" : ""}.`,
          `Approval ids: ${ids.join(", ")}`,
          `Batch: ${batchId}`,
        ].join("\n"),
        author: { name: approverName, email: user?.email ?? `${actor.userId}@users.noreply.invalid`, date },
        files: picked.map((row, i) => ({
          path: row.file,
          expectedHash: row.hash!,
          content: withReviewFlags(i === 0 && edited !== null ? edited : texts[i], flagFor(row.file)!, { name: approverName, date }),
        })),
        body: prBody(picked.map((r, i) => ({ title: r.title, path: r.path, file: r.file, edited: i === 0 && edited !== null })), tier, approverName, date.slice(0, 10), note, ids, batchId),
      },
      deps.fetch,
    );
    for (const r of records) r.prUrl = pullRequest.url;
  }

  // A second approval of the same version fails on the schema's unique (path, content_hash).
  const approvals: PageApproval[] = [];
  for (const r of records) approvals.push(await db.pageApprovals.insert(r));
  await audit(db, actor, {
    action: "page.approve",
    resourceType: "page_batch",
    resourceId: batchId,
    detail: {
      count: approvals.length,
      batchId,
      tier,
      paths: approvals.map((a) => a.path),
      edited: edited !== null,
      pullRequest: pullRequest?.url ?? null,
    },
    at: now,
  });
  return { batchId, tier, approvals, pullRequest };
}

// ---------- Export for scripts/apply-page-approvals.mts ----------

export interface ApprovalExport {
  exportedAt: string;
  approvals: (PageApproval & { matchesCurrentFile: boolean })[];
}

/** Every approval, with whether it still matches the deployed file. The apply script re-checks every hash itself. */
export async function exportPageApprovals(db: Db, actor: Actor, source: PageSource = repoPages, now = new Date()): Promise<ApprovalExport> {
  assertReviewer(actor, "Only attorneys and platform admins can export page approvals");
  const approvals = (await db.pageApprovals.list()).sort((a, b) => a.approvedAt.localeCompare(b.approvedAt) || a.path.localeCompare(b.path));
  return {
    exportedAt: now.toISOString(),
    approvals: approvals.map((a) => ({ ...a, matchesCurrentFile: fileHash(source.root, a.file) === a.contentHash })),
  };
}

// ---------- Preview ----------

/** Renders edited markdown with the same renderer the live page uses. */
export async function previewPageEdit(actor: Actor, pagePath: string, body: string, source: PageSource = repoPages): Promise<{ html: string }> {
  assertReviewer(actor, "Only attorneys and platform admins can preview page edits");
  const item = source.items().find((i) => i.path === pagePath);
  if (!item) throw new Error(`Unknown page: ${pagePath}`);
  const text = String(body ?? "").slice(0, MAX_EDIT_BYTES);
  if (/^content\/(learn|states)\//.test(fileFor(item.path))) return { html: renderLibrary(text, { autolink: true, self: item.path }).html };
  return { html: renderContent(text).html };
}
