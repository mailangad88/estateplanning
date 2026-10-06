/**
 * Writes the attorney's page approvals into the content files (docs/content-pipeline.md section 7). This is the
 * fallback when the portal does not open pull requests itself (GITHUB_CONTENT_TOKEN unset). A person runs it and
 * commits the result like any other change.
 *
 * For each approved page it re-hashes the file and refuses it when no attorney approval matches the file as it
 * reads now, ignores approvals by anyone but an attorney and approvals already carried by a pull request, and
 * sets `review: approved` (library and state pages) or `reviewed: true` (guides, comparisons, posts, life
 * events) plus `reviewedBy` and `lastReviewed`. Nothing else in the file changes.
 *
 * Usage:
 *   npm run review:apply -- --from page-approvals.json     # the export from /api/portal/page-approvals/export
 *   DATABASE_URL=postgres://... npm run review:apply       # read page_approvals directly
 *   add --dry-run to print the changes without writing, --json for a machine-readable report,
 *   --root <dir> to work on another checkout
 */
import fs from "node:fs";
import path from "node:path";
import { applyApprovals } from "../src/server/content/applyApprovals";
import type { PageApproval } from "../src/server/types";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function loadApprovals(): Promise<PageApproval[]> {
  const from = opt("--from");
  if (from) {
    const data = JSON.parse(fs.readFileSync(path.resolve(from), "utf8"));
    return Array.isArray(data) ? data : (data.approvals ?? []);
  }
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const { rows } = await client.query(
        "SELECT id, path, file, content_hash, tier, approved_by, approver_role, approver_name, approved_at, note, batch_id, pr_url, edited_from_hash FROM page_approvals",
      );
      return rows.map((r) => ({
        id: r.id, path: r.path, file: r.file, contentHash: r.content_hash, tier: r.tier, approvedBy: r.approved_by,
        approverRole: r.approver_role, approverName: r.approver_name, approvedAt: new Date(r.approved_at).toISOString(),
        note: r.note, batchId: r.batch_id, prUrl: r.pr_url ?? undefined, editedFromHash: r.edited_from_hash ?? undefined,
      }));
    } finally {
      await client.end();
    }
  }
  throw new Error("Pass --from <export.json> or set DATABASE_URL");
}

async function main() {
  const dryRun = flag("--dry-run");
  const report = applyApprovals(path.resolve(opt("--root") ?? process.cwd()), await loadApprovals(), { dryRun });
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const a of report.applied) console.log(`${dryRun ? "Would approve" : "Approved"} ${a.file} (${a.flag}, ${a.reviewedBy}, ${a.lastReviewed})`);
  for (const r of report.refused) console.log(`REFUSED ${r.file}: ${r.reason}`);
  for (const r of report.ignored) console.log(`Ignored ${r.path}: ${r.reason}`);
  console.log(`\n${report.applied.length} ${dryRun ? "to write" : "written"}, ${report.alreadyPublished.length} already published, ${report.refused.length} refused, ${report.ignored.length} ignored.`);
  if (!dryRun && report.applied.length) console.log("Review the diff and commit it. Nothing is pushed by this script.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
