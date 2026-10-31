import Link from "next/link";
import { can } from "@/server/auth/policy";
import { referralReport, OUTCOME_LABELS, REASON_LABELS, type ReferralReport } from "@/server/services/referrals";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import styles from "./referrals.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referrals", robots: { index: false, follow: false } };

const DAY = 86_400_000;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const tone = (o: string) => (o === "retained" || o === "booked" || o === "accepted" ? "good" : o === "declined" || o === "no_response" ? "bad" : undefined);

function Bars({ rows, label }: { rows: { key: string; name: string; sub?: string; total: number }[]; label: string }) {
  if (!rows.length) return <p className={styles.empty}>No referrals in this period.</p>;
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <ul className={styles.bars} aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className={styles.bar}>
          <span className={styles.barLabel}>{r.name}{r.sub && <small>{r.sub}</small>}</span>
          <span className={styles.track}>
            <span className={styles.fill} style={{ width: `${(r.total / max) * 100}%` }} tabIndex={0} data-tip={`${r.name}: ${r.total}`} aria-label={`${r.name}: ${r.total}`} />
            <span className={styles.value}>{r.total}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Monthly({ r, primaryName }: { r: ReferralReport; primaryName: string }) {
  if (!r.byMonth.length) return <p className={styles.empty}>No leads reached an attorney in this period.</p>;
  const max = Math.max(...r.byMonth.map((m) => m.handled + m.referred + m.elsewhere));
  const series = [
    { key: "referred", label: `Referred on by ${primaryName}` },
    { key: "handled", label: `Handled by ${primaryName}` },
    { key: "elsewhere", label: "Went elsewhere" },
  ] as const;
  return (
    <>
      <ul className={styles.legend}>
        {series.map((s) => <li key={s.key}><span className={styles.swatch} style={{ background: `var(--series-${s.key})` }} />{s.label}</li>)}
      </ul>
      <div className={styles.columns} role="img" aria-label={`Leads per month: handled by ${primaryName}, referred on, or went elsewhere. The table below has the numbers.`}>
        {r.byMonth.map((m) => {
          const total = m.handled + m.referred + m.elsewhere;
          return (
            <div key={m.month} className={styles.col}>
              <span className={styles.colTotal}>{total}</span>
              {series.map((s) => m[s.key] > 0 && (
                <span
                  key={s.key}
                  className={styles.seg}
                  data-series={s.key}
                  tabIndex={0}
                  style={{ height: `${(m[s.key] / max) * 85}%` }}
                  data-tip={`${monthName(m.month)} · ${s.label}: ${m[s.key]}`}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className={styles.months}>{r.byMonth.map((m) => <span key={m.month}>{monthName(m.month)}</span>)}</div>
      <details>
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th>Month</th><th>Handled</th><th>Referred on</th><th>Went elsewhere</th></tr></thead>
          <tbody>{r.byMonth.map((m) => <tr key={m.month}><td>{monthName(m.month)}</td><td>{m.handled}</td><td>{m.referred}</td><td>{m.elsewhere}</td></tr>)}</tbody>
        </table>
      </details>
    </>
  );
}

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_referrals")) return <p>Referral tracking is for the office and platform admins.</p>;
  const sp = await searchParams;
  const to = sp.to ? new Date(`${sp.to}T23:59:59Z`) : new Date();
  const from = sp.from ? new Date(`${sp.from}T00:00:00Z`) : new Date(to.getTime() - 180 * DAY);
  const r = await referralReport(scopedDb(await getDb(), actor), actor, { from, to });
  const primaryName = r.primary?.name.replace(/,? Esq\.?$/, "") ?? "the primary attorney";

  return (
    <div className={styles.viz}>
      <div>
        <p><Link href="/admin/analytics">← Analytics</Link> · <Link href="/admin/pipeline">Pipeline</Link></p>
        <h1>Referrals</h1>
        <p className="notice">
          Every lead goes to {primaryName} first. This tracks the ones {primaryName} passed to someone else: who, when, why and what happened.
          Referral fees are not tracked; that waits on the Illinois rules review.
        </p>
        <form className={styles.filters} method="get">
          <label>From<input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} /></label>
          <label>To<input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} /></label>
          <button className="button secondary" type="submit">Update</button>
        </form>
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <p className={styles.tileValue}>{r.handledByPrimary}</p>
          <p className={styles.tileLabel}><span className={styles.swatch} style={{ background: "var(--series-handled)" }} />Handled by {primaryName} · {pct(r.handledByPrimary, r.routed)}</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileValue}>{r.referredByPrimary}</p>
          <p className={styles.tileLabel}><span className={styles.swatch} style={{ background: "var(--series-referred)" }} />Referred on · {pct(r.referredByPrimary, r.routed)}</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileValue}>{r.wentElsewhere}</p>
          <p className={styles.tileLabel}><span className={styles.swatch} style={{ background: "var(--series-elsewhere)" }} />Went elsewhere · declined, timed out or client&apos;s choice</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileValue}>{r.rows.length}</p>
          <p className={styles.tileLabel}>Referrals logged · {r.outcomes.find((o) => o.outcome === "retained")?.total ?? 0} retained</p>
        </div>
      </div>

      <section className={styles.chart}>
        <h2>Who handled each lead, by month</h2>
        <p>{r.routed} leads reached an attorney between {day(r.period.from)} and {day(r.period.to)}.</p>
        <Monthly r={r} primaryName={primaryName} />
      </section>

      <section className={styles.chart}>
          <h2>Referred to</h2>
          <p>Each attorney who received a lead, with how those referrals turned out.</p>
          <Bars
            label="Referrals by receiving attorney"
            rows={r.byRecipient.map((x) => ({
              key: x.name,
              name: x.name,
              sub: `${x.outside ? "Outside the platform · " : ""}${Object.entries(x.outcomes).filter(([, n]) => n > 0).map(([o, n]) => `${n} ${OUTCOME_LABELS[o as keyof typeof OUTCOME_LABELS].toLowerCase()}`).join(", ")}`,
              total: x.total,
            }))}
          />
      </section>

      <div className={styles.twoUp}>
        <section className={styles.chart}>
          <h2>Why</h2>
          <p>The reason given for each referral.</p>
          <Bars label="Referrals by reason" rows={r.byReason.map((x) => ({ key: x.reason, name: x.label, total: x.total }))} />
        </section>
        <section className={styles.chart}>
          <h2>What happened</h2>
          <p>Platform referrals update themselves; outside ones are updated on the lead.</p>
          <Bars label="Referrals by outcome" rows={r.rows.length ? r.outcomes.filter((o) => o.total > 0).map((x) => ({ key: x.outcome, name: x.label, total: x.total })) : []} />
        </section>
        {r.byReferrer.length > 1 && (
          <section className={styles.chart}>
            <h2>Referred by</h2>
            <p>Who passed leads on.</p>
            <Bars label="Referrals by referring attorney" rows={r.byReferrer.map((x) => ({ key: x.name, name: x.name, total: x.total }))} />
          </section>
        )}
      </div>

      <section>
        <h2>Referral log</h2>
        {r.rows.length === 0 ? <p className={styles.empty}>No referrals in this period.</p> : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Date</th><th>From</th><th>To</th><th>Why</th><th>Outcome</th><th>Lead</th></tr></thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.id}>
                    <td>{day(x.referredAt)}</td>
                    <td>{x.fromName}</td>
                    <td>{x.toName}{x.toLawyerId ? "" : " (outside)"}</td>
                    <td>{REASON_LABELS[x.reason]}</td>
                    <td><span className={styles.badge} data-tone={tone(x.effective)}>{OUTCOME_LABELS[x.effective]}</span></td>
                    <td><Link href={`/portal/leads/${x.leadId}#referrals`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
