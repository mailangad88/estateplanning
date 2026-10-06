import Link from "next/link";
import { firm } from "@/config/firm";
import { feePermission } from "@/lib/fees";
import { can } from "@/server/auth/policy";
import { currentRuleVersions, previewInvoice, ruleHistory } from "@/server/fees/admin";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { DEMO_FIRM_ID } from "@/server/seed";
import { FeeRuleEditor } from "./FeeRuleEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee rules", robots: { index: false, follow: false } };

const STRUCTURE_LABELS: Record<string, string> = {
  in_firm: "Model A: the platform is the firm's own marketing and intake department",
  marketing_services: "Model B: separate marketing company paid flat fees",
  certified_lrs: "Model C: state-certified lawyer referral service",
  abs: "Model D: alternative business structure (Arizona, Utah)",
  saas: "Model E: the firm licenses the software",
};

const PERMISSION_LABELS = { allowed: "Allowed", needs_counsel_approval: "Needs counsel approval", prohibited: "Prohibited" } as const;

function monthBounds(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)] as const;
}

export default async function FeeAdmin() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "manage_fee_rules")) return <p>Only platform admins can manage fee rules.</p>;
  const db = scopedDb(await getDb(), actor);
  const versions = await currentRuleVersions(db);
  const [start, end] = monthBounds();
  const history: Record<string, Awaited<ReturnType<typeof ruleHistory>>> = {};
  for (const v of versions) history[v.ruleId] = await ruleHistory(db, v.ruleId);
  const preview = await previewInvoice(db, DEMO_FIRM_ID, start, end, firm.structure);

  return (
    <>
      <h1>Fee rules</h1>
      <p className="lead">{STRUCTURE_LABELS[firm.structure]}</p>
      <p>
        Rates are editable. Whether a rule bills anything depends on the business structure and, for some fee types, a
        recorded ethics counsel approval. A non-lawyer sharing in legal fees (Rule 5.4) or being paid for a
        recommendation (Rule 7.2) is prohibited in most states, so percentage-of-fee and per-signed-retainer rules stay
        locked unless the structure permits them. Edits create a new version and never change past invoices.
      </p>

      {versions.map((v) => {
        const permission = feePermission(v.rule.feeType, firm.structure);
        return (
          <section key={v.ruleId} className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>{v.ruleId} <span className="notice">({v.rule.feeType.replaceAll("_", " ")}, version {v.version})</span></h2>
            <p>
              <strong>{v.billable ? "Billable" : "Locked"}</strong>
              {v.lockReason ? `: ${v.lockReason}` : ""} · Under this structure: {PERMISSION_LABELS[permission]}
              {v.counsel ? ` · Counsel: ${v.counsel.name} (${v.counsel.opinionRef})` : ""}
            </p>
            <FeeRuleEditor rule={v.rule} canApprove={can(actor, "approve_fee_rule") && permission === "needs_counsel_approval"} />
            <details>
              <summary>History</summary>
              <ul>
                {history[v.ruleId].reverse().map((h) => (
                  <li key={h.id}>v{h.version} · {h.editedAt.slice(0, 16).replace("T", " ")} · {h.editedBy} · {h.reason}</li>
                ))}
              </ul>
            </details>
          </section>
        );
      })}

      <h2>This month&apos;s invoice preview</h2>
      <p>{preview.lines.length} billable lines, total ${(preview.totalCents / 100).toFixed(2)}. {preview.blockedRules.length} rules locked.</p>
      <p className="notice">Invoices are created as drafts and reviewed by an admin before anything is sent.</p>
    </>
  );
}
