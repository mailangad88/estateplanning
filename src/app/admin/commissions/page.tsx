import Link from "next/link";
import { CheckCircle2, Clock, Download, Wallet } from "lucide-react";
import { DEFAULT_COMMISSION, money, type CommissionStatus } from "@/lib/commission";
import { can, ForbiddenError } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { commissionReport } from "@/server/services/commissions";
import styles from "../cases/cases.module.css";
import { initials } from "../cases/parts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paralegal commissions", robots: { index: false, follow: false } };

const STATUS: Record<CommissionStatus, { label: string; cls: string }> = {
  pending: { label: "Pending (case open)", cls: styles.chipPending },
  earned: { label: "Earned, not paid", cls: styles.chipEarned },
  paid: { label: "Paid", cls: styles.chipPaid },
};
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

type Search = { paralegal?: string; status?: string };

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_commissions")) return <p>Commissions are for the case team.</p>;
  const sp = await searchParams;
  const status = (["pending", "earned", "paid"] as const).find((s) => s === sp.status);
  let report;
  try {
    report = await commissionReport(scopedDb(await getDb(), actor), actor, { paralegalId: sp.paralegal || undefined, status });
  } catch (err) {
    if (err instanceof ForbiddenError) return <p>{err.message}</p>;
    throw err;
  }
  const isPara = actor.role === "paralegal";
  const office = actor.role === "platform_admin" || actor.role === "firm_admin";
  const max = Math.max(1, ...report.totals.map((t) => t.pendingCents + t.earnedCents + t.paidCents));
  const pct = (c: number) => `${(c / max) * 100}%`;
  const q = (patch: Search) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]).toString();
    return u ? `/admin/commissions?${u}` : "/admin/commissions";
  };

  return (
    <div className={styles.board}>
      <p className={styles.back}><Link href="/portal">← Portal</Link> · <Link href="/admin/cases">Cases</Link></p>
      <div className={styles.head}>
        <div>
          <h1>{isPara ? "Your commission" : "Paralegal commissions"}</h1>
          <p className={styles.lede}>
            {isPara ? "Commission on the cases assigned to you." : "Commission on each case, and totals per paralegal."}
            {" "}Earned when the file is closed. Firm default: {DEFAULT_COMMISSION.mode === "percent" ? `${DEFAULT_COMMISSION.percent}% of the fee` : money(DEFAULT_COMMISSION.flatCents)} unless the case sets its own.
          </p>
        </div>
        {office && <a className="button small secondary" href="/api/admin/commissions/export"><Download size={14} aria-hidden /> Export CSV for payroll</a>}
      </div>
      {!isPara && <p className={styles.ethics}>Internal tracking only. Before paying from this, the attorney confirms the plan fits Illinois Rules 5.4 and 7.2: a paralegal can share in a compensation plan, but not in the fee from a particular case or for bringing in clients.</p>}

      <ul className={styles.tiles} aria-label="Commission totals">
        <li><Link className={`${styles.tile} ${status === "pending" ? styles.tileOn : ""}`} href={q({ status: status === "pending" ? undefined : "pending" })}><span className={styles.tileIcon}><Clock size={18} aria-hidden /></span><span><span className={styles.tileNum}>{money(report.all.pendingCents)}</span><span className={styles.tileLabel}>Pending, cases still open</span></span></Link></li>
        <li><Link className={`${styles.tile} ${styles.tileWarn} ${status === "earned" ? styles.tileOn : ""}`} href={q({ status: status === "earned" ? undefined : "earned" })}><span className={styles.tileIcon}><Wallet size={18} aria-hidden /></span><span><span className={styles.tileNum}>{money(report.all.earnedCents)}</span><span className={styles.tileLabel}>Earned, not paid yet</span></span></Link></li>
        <li><Link className={`${styles.tile} ${styles.tileGood} ${status === "paid" ? styles.tileOn : ""}`} href={q({ status: status === "paid" ? undefined : "paid" })}><span className={styles.tileIcon}><CheckCircle2 size={18} aria-hidden /></span><span><span className={styles.tileNum}>{money(report.all.paidCents)}</span><span className={styles.tileLabel}>Paid</span></span></Link></li>
      </ul>

      {report.totals.length > 0 && (
        <section className={styles.panel} aria-label="Totals per paralegal">
          <h2>{isPara ? "Your total" : "By paralegal"}</h2>
          <ul className={styles.bars}>
            {report.totals.map((t) => {
              const total = t.pendingCents + t.earnedCents + t.paidCents;
              return (
                <li key={t.paralegalId} className={styles.barRow}>
                  <Link className={styles.barName} href={isPara ? "#" : q({ paralegal: sp.paralegal === t.paralegalId ? undefined : t.paralegalId })}>
                    <span className={`${styles.avatar} ${styles.avatarPara}`}>{initials(t.name)}</span>{t.name}
                  </Link>
                  <span className={styles.barTrack} role="img" aria-label={`${t.name}: ${money(t.paidCents)} paid, ${money(t.earnedCents)} earned, ${money(t.pendingCents)} pending, on ${t.cases} cases`}>
                    <span className={styles.segPaid} style={{ width: pct(t.paidCents) }} />
                    <span className={styles.segEarned} style={{ width: pct(t.earnedCents) }} />
                    <span className={styles.segPending} style={{ width: pct(t.pendingCents) }} />
                  </span>
                  <span className={styles.barTotal}>{money(total)}<span className={styles.cardMeta}>{t.cases} {t.cases === 1 ? "case" : "cases"}</span></span>
                </li>
              );
            })}
          </ul>
          <p className={styles.legend}><span><i className={styles.segPaid} />Paid</span><span><i className={styles.segEarned} />Earned, not paid</span><span><i className={styles.segPending} />Pending (case open)</span></p>
        </section>
      )}

      <table className={styles.ctable}>
        <thead><tr><th>Case</th>{!isPara && <th>Paralegal</th>}<th>Attorney</th><th>Rule</th><th>Fee</th><th>Commission</th><th>Status</th></tr></thead>
        <tbody>
          {report.rows.length === 0 && <tr><td colSpan={7} className={styles.emptyCol}>{isPara ? "No commission yet. It appears once a case is assigned to you." : "No cases with a paralegal yet."}</td></tr>}
          {report.rows.map((r) => (
            <tr key={r.leadId}>
              <td data-label="Case"><Link href={`/admin/cases/${r.leadId}#commission`}><b>{r.name}</b></Link></td>
              {!isPara && <td data-label="Paralegal">{r.paralegalName}</td>}
              <td data-label="Attorney">{r.lawyerName?.replace(/,?\s*Esq\.?$/i, "") ?? ""}</td>
              <td data-label="Rule">{r.line.mode === "flat" ? "Flat" : `${r.line.percent}% of fee`}{r.line.isDefault && <span className={styles.cardMeta}>firm default</span>}</td>
              <td data-label="Fee">{r.line.feeCents ? money(r.line.feeCents) : <span className={styles.cardMeta}>No fee yet</span>}{r.line.feeSource === "package" && <span className={styles.cardMeta}>from package</span>}</td>
              <td data-label="Commission" className={styles.num}>{money(r.line.amountCents)}</td>
              <td data-label="Status"><span className={`${styles.chip} ${STATUS[r.line.status].cls}`}>{STATUS[r.line.status].label}</span>{r.line.paidAt && <span className={styles.cardMeta}>{day(r.line.paidAt)}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>The fee is the signed retainer's total, or the package price from the intake questionnaire until a retainer is on file. A case that ends early earns nothing. Every view and change is recorded in the audit log.</p>
    </div>
  );
}
