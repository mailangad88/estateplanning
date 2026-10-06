import Link from "next/link";
import { can } from "@/server/auth/policy";
import { reviewTrackingReport } from "@/server/nurture/reviews";
import { currentSession } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review requests", robots: { index: false, follow: false } };

const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const LABEL = {
  posted: "Said they posted", opted_out: "Opted out", reminded: "Asked and reminded", asked: "Asked", pending: "Not yet due", overdue: "Overdue", excluded: "Excluded by rule",
} as const;

export default async function ReviewRequestsPage() {
  const session = await currentSession();
  if (!session) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  const { actor, db } = session;
  if (!can(actor, "view_review_tracking")) return <p>Review tracking is for platform and firm admins.</p>;
  const r = await reviewTrackingReport(db, actor);
  const t = r.totals;

  return (
    <>
      <h1>Review requests</h1>
      <p className="notice">
        Proof that every eligible client was asked. Everyone is sent the same neutral email at 14 days after signing and one reminder at 21 days (a text if they
        agreed to texts, an email if not). Nothing depends on how a client felt, what they said or whether they opened an email. Matter ids only, no client names.
      </p>

      <p>
        <strong>{r.everyEligibleAsked ? "Every eligible client has been asked on schedule." : "Needs attention: see the overdue and untracked lists below."}</strong>
      </p>
      <table>
        <thead><tr><th>Tracked</th><th>Eligible</th><th>Excluded</th><th>Asked</th><th>Reminded</th><th>Opted out</th><th>Said they posted</th><th>Not yet due</th><th>Overdue</th></tr></thead>
        <tbody><tr><td>{t.tracked}</td><td>{t.eligible}</td><td>{t.excluded}</td><td>{t.asked}</td><td>{t.reminded}</td><td>{t.optedOut}</td><td>{t.posted}</td><td>{t.pending}</td><td>{t.overdue}</td></tr></tbody>
      </table>

      {r.untracked.length > 0 && (
        <p>Signed but not tracked ({r.untracked.length}): {r.untracked.join(", ")}. These need a decision from the attorney; none was silently skipped.</p>
      )}
      {Object.keys(r.exclusionsByCode).length > 0 && (
        <p>
          Exclusions by written rule: {Object.entries(r.exclusionsByCode).map(([k, n]) => `${k} (${n})`).join(", ")}.
          Check monthly that no exclusion follows a complaint and none follows praise: that pattern is review gating.
        </p>
      )}

      <h2>By matter</h2>
      {r.rows.length === 0 ? (
        <p>No signed matters yet.</p>
      ) : (
        <table>
          <thead><tr><th>Matter</th><th>Type</th><th>Signed</th><th>Status</th><th>Reason</th><th>Asked</th><th>Reminded</th><th>Opted out</th><th>Said they posted</th></tr></thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.matterId}>
                <td>{x.matterId}</td>
                <td>{x.matterType.replace(/_/g, " ")}</td>
                <td>{day(x.anchorAt)}</td>
                <td>{LABEL[x.status]}</td>
                <td>{x.exclusionCode ?? ""}</td>
                <td>{day(x.askedAt)}</td>
                <td>{x.remindedAt ? `${day(x.remindedAt)} (${x.reminderChannel})` : ""}</td>
                <td>{day(x.optedOutAt)}</td>
                <td>{day(x.postedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
