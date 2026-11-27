import Link from "next/link";
import { devLoginEnabled } from "@/server/auth/session";
import { portalHome, type Tone } from "@/server/portal/home";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import LeadPanelSlot from "./leads/LeadPanelSlot";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portal", robots: { index: false, follow: false } };

async function SignIn() {
  const db = await getDb();
  return (
    <>
      <h1>Portal sign-in</h1>
      {devLoginEnabled() ? (
        <form method="post" action="/api/auth/dev-login" className="card">
          <p className="notice">Development sign-in. Turned off in production, where sign-in goes through the identity provider with two-step verification.</p>
          <label className="field">
            Sign in as
            <select name="userId">
              {(await db.users.list((u) => u.active)).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.replace("_", " ")})</option>
              ))}
            </select>
          </label>
          <button className="button">Sign in</button>
        </form>
      ) : (
        <p><Link className="button" href="/portal/login">Sign in with your email</Link> Sign-in requires two-step verification.</p>
      )}
    </>
  );
}

const TONE_CLASS: Record<Tone, string> = { neutral: styles.tNeutral, info: styles.tInfo, good: styles.tGood, warn: styles.tWarn, danger: styles.tDanger };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const actor = await currentActor();
  if (!actor) return <SignIn />;
  const db = scopedDb(await getDb(), actor);

  if (actor.role === "marketing") {
    const leads = await db.leads.list();
    const byStage = new Map<string, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);
    return (
      <div className={styles.home}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Home · Marketing</p>
          <h1>Funnel at a glance</h1>
          <p className={styles.summary}>Marketing sees totals only, never individual intake details.</p>
          <p className={styles.actions}><Link className={styles.actionPrimary} href="/admin/analytics">Funnel analytics</Link><Link className={styles.action} href="/admin/seminars">Seminars</Link></p>
        </section>
        <ul className={styles.kpis}>
          {[...byStage].map(([s, n]) => <li key={s} className={`${styles.kpi} ${styles.tInfo}`}><span className={styles.kpiNum}>{n}</span><span className={styles.kpiLabel}>{s.replaceAll("_", " ")}</span></li>)}
        </ul>
      </div>
    );
  }

  const home = await portalHome(db, actor);
  const { lead: openLead } = await searchParams;
  return (
    <div className={styles.home}>
      <div className={styles.top}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Home</p>
          <h1>{home.headline}</h1>
          <p className={styles.summary}>{home.summary}</p>
          {home.actions.length > 0 && (
            <p className={styles.actions}>
              {home.actions.map((a) => <Link key={a.href} href={a.href} className={a.primary ? styles.actionPrimary : styles.action}>{a.label}</Link>)}
            </p>
          )}
        </section>
        <ul className={styles.kpis} aria-label="Today at a glance">
          {home.kpis.map((k) => {
            const inner = <><span className={styles.kpiNum}>{k.value}</span><span className={styles.kpiLabel}>{k.label}</span></>;
            return <li key={k.key}>{k.href ? <Link href={k.href} className={`${styles.kpi} ${TONE_CLASS[k.tone]}`}>{inner}</Link> : <div className={`${styles.kpi} ${TONE_CLASS[k.tone]}`}>{inner}</div>}</li>;
          })}
        </ul>
      </div>

      <div className={styles.panels}>
        <section className={styles.panel} id="work">
          <header className={styles.panelHead}><h2>{home.workTitle}</h2><span className={styles.count}>{home.work.length}</span></header>
          {home.work.length === 0 ? (
            <p className={styles.empty}><CheckCircle2 size={20} aria-hidden /> You are all caught up.</p>
          ) : (
            <ul className={styles.workList}>
              {home.work.map((w) => (
                <li key={w.key} className={`${styles.workItem} ${w.chip?.tone === "danger" ? styles.workHot : ""}`}>
                  <div className={styles.workText}>
                    <Link href={w.href} className={styles.workTitle}>{w.title}</Link>
                    <span className={styles.workDetail}>{w.detail}</span>
                  </div>
                  {w.chip && <span className={`${styles.chip} ${TONE_CLASS[w.chip.tone]}`}>{w.chip.label}</span>}
                  <Link href={w.href} className={styles.cta}>{w.cta}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHead}>
            <h2>{home.leadsTitle}</h2>
            {home.leadsHref && <Link href={home.leadsHref} className={styles.seeAll}>See all <ArrowRight size={14} aria-hidden /></Link>}
          </header>
          {home.leads.length === 0 ? <p className={styles.empty}>Nothing here yet.</p> : (
            <ul className={styles.leadList}>
              {home.leads.map((l) => (
                <li key={l.leadId}>
                  <Link href={l.href.startsWith("/portal/leads/") ? `/portal?lead=${l.leadId}` : l.href} scroll={false} className={`${styles.leadRow} ${openLead === l.leadId ? styles.leadRowOn : ""}`}>
                    <span className={styles.leadAvatar} aria-hidden>{l.name.slice(0, 1)}</span>
                    <span className={styles.leadText}>
                      <span className={styles.leadName}>{l.name}{l.urgent && <span className={`${styles.chip} ${styles.tDanger}`}>Urgent</span>}</span>
                      <span className={styles.leadMeta}>{l.matter} · {l.ageDays === 0 ? "today" : `${l.ageDays}d`}</span>
                    </span>
                    <span className={`${styles.chip} ${TONE_CLASS[l.tone]}`}>{l.stage}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <LeadPanelSlot actor={actor} leadId={openLead} closeHref="/portal" />
    </div>
  );
}
