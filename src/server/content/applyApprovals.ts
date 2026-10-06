/**
 * The fallback path for page approvals when the portal does not open pull requests (no GITHUB_CONTENT_TOKEN):
 * scripts/apply-page-approvals.mts calls this to write the review flags into a checkout, which a person commits.
 * It never writes a flag without an attorney approval whose hash matches the file as it reads now.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileFor } from "@/lib/review-queue";
import { flagFor, isFlagged, withReviewFlags } from "@/lib/review-flags";
import type { PageApproval } from "@/server/types";

export interface ApplyReport {
  root: string;
  dryRun: boolean;
  applied: { path: string; file: string; flag: string; reviewedBy: string; lastReviewed: string; approvalId: string; batchId: string }[];
  alreadyPublished: { path: string; file: string }[];
  refused: { path: string; file: string; reason: string }[];
  ignored: { path: string; reason: string }[];
}

type Approval = Partial<PageApproval> & { path: string; file: string };

export function applyApprovals(root: string, approvals: Approval[], { dryRun = false } = {}): ApplyReport {
  const report: ApplyReport = { root, dryRun, applied: [], alreadyPublished: [], refused: [], ignored: [] };
  const byFile = new Map<string, Approval[]>();
  for (const a of approvals) {
    if (a.approverRole !== "attorney") {
      report.ignored.push({ path: a.path, reason: `approved by ${a.approverRole ?? "unknown role"}, not an attorney` });
      continue;
    }
    if (a.prUrl) {
      report.ignored.push({ path: a.path, reason: `carried by pull request ${a.prUrl}` });
      continue;
    }
    byFile.set(a.file, [...(byFile.get(a.file) ?? []), a]);
  }

  for (const [file, list] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    const pagePath = list[0].path;
    const refuse = (reason: string) => report.refused.push({ path: pagePath, file, reason });
    if (typeof file !== "string" || !/^content\/[a-z0-9][a-z0-9/_-]*\.md$/.test(file) || file.includes("..")) { refuse("not a content file"); continue; }
    if (list.some((a) => fileFor(a.path) !== file)) { refuse("approval path does not match its file"); continue; }
    const flag = flagFor(file);
    if (!flag) { refuse("this kind of page has no review flag"); continue; }
    const full = path.join(root, file);
    if (!fs.existsSync(full)) { refuse("file not found"); continue; }
    const raw = fs.readFileSync(full);
    const text = raw.toString("utf8");
    if (isFlagged(text, flag)) { report.alreadyPublished.push({ path: pagePath, file }); continue; }
    const hash = createHash("sha256").update(raw).digest("hex");
    const match = list
      .filter((a) => a.contentHash === hash && !a.editedFromHash)
      .sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))[0];
    if (!match) {
      refuse(list.some((a) => a.editedFromHash) ? "edited in the portal: the edits travel only in a pull request" : "changed since the attorney approved it: needs a new approval");
      continue;
    }
    const name = String(match.approverName || match.approvedBy);
    const date = String(match.approvedAt).slice(0, 10);
    let next: string;
    try {
      next = withReviewFlags(text, flag, { name, date });
    } catch (e) {
      refuse((e as Error).message);
      continue;
    }
    if (!dryRun) fs.writeFileSync(full, next);
    report.applied.push({ path: pagePath, file, flag: `${flag.key}: ${flag.value}`, reviewedBy: name, lastReviewed: date, approvalId: String(match.id), batchId: String(match.batchId) });
  }
  return report;
}
