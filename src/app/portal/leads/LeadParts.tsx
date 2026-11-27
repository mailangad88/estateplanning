import Link from "next/link";
import { Check, ExternalLink, Maximize2, X } from "lucide-react";
import type { CaseView } from "@/server/portal/caseView";
import type { LeadSnapshot } from "@/server/portal/leadSnapshot";
import styles from "./leads.module.css";

const TONE: Record<string, string> = { good: styles.tGood, warn: styles.tWarn, danger: styles.tDanger, neutral: styles.tNeutral, info: styles.tInfo };

export function StatusChips({ snap, stage }: { snap: LeadSnapshot; stage?: string }) {
  return (
    <p className={styles.chips}>
      <span className={`${styles.chip} ${TONE[snap.status.tone]}`}>{snap.status.label}</span>
      {snap.phaseLabel && <span className={styles.tag}>{snap.phaseLabel}</span>}
      {stage && <span className={styles.tag}>{stage}</span>}
    </p>
  );
}

/** Six phases from lead in to closed file, with the current one numbered. */
export function StageTracker({ snap }: { snap: LeadSnapshot }) {
  return (
    <div className={styles.trackerWrap}>
      <ol className={styles.tracker} aria-label="Where this lead is">
        {snap.phases.map((p, i) => (
          <li key={p.key} className={`${styles.phase} ${styles[`p_${p.state}`]}`} aria-current={p.state === "current" ? "step" : undefined}>
            <span className={styles.node} aria-hidden>{p.state === "done" ? <Check size={13} strokeWidth={3} /> : p.state === "stopped" ? <X size={13} strokeWidth={3} /> : i + 1}</span>
            <span className={styles.phaseLabel}>{p.label}</span>
          </li>
        ))}
      </ol>
      {snap.stepNote && <p className={styles.stepNote}>{snap.stepNote}</p>}
    </div>
  );
}

export function OpenTasks({ snap, nextStep }: { snap: LeadSnapshot; nextStep?: string }) {
  return (
    <section className={styles.block}>
      <h2 className={styles.blockHead}>Open tasks <span>({snap.tasks.length})</span></h2>
      {nextStep && <p className={styles.next}><strong>Next step:</strong> {nextStep}</p>}
      {snap.tasks.length === 0 ? <p className={styles.muted}>No open tasks.</p> : (
        <ul className={styles.tasks}>
          {snap.tasks.map((t) => (
            <li key={t.id}>
              <span><span className={styles.taskTitle}>{t.title}</span><span className={`${styles.muted} ${t.overdue ? styles.overdue : ""}`}>due {t.due}</span></span>
              <span className={`${styles.chip} ${t.overdue ? styles.tDanger : styles.tNeutral}`}>{t.overdue ? "Overdue" : "Open"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DetailsList({ snap, open = true }: { snap: LeadSnapshot; open?: boolean }) {
  return (
    <details className={styles.block} open={open}>
      <summary className={styles.blockHead}>Details</summary>
      <dl className={styles.details}>
        {snap.details.map((d) => <div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}
      </dl>
    </details>
  );
}

/** Slide-over preview of a lead, with a button to open it as a full page. */
export function LeadPanel({ view, snap, closeHref }: { view: CaseView; snap: LeadSnapshot; closeHref: string }) {
  const h = view.header;
  const full = `/portal/leads/${h.leadId}`;
  return (
    <aside className={styles.panel} aria-label={`Lead ${h.name}`}>
      <div className={styles.panelBar}>
        <span>Lead</span>
        <Link href={full} className={styles.panelIcon} title="Open as a full page"><Maximize2 size={16} aria-hidden /><span className="sr-only">Open as a full page</span></Link>
        <Link href={closeHref} scroll={false} className={styles.panelIcon} title="Close"><X size={18} aria-hidden /><span className="sr-only">Close</span></Link>
      </div>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>{h.name}</h2>
        <StatusChips snap={snap} />
        <StageTracker snap={snap} />
        <OpenTasks snap={snap} nextStep={h.nextStep} />
        {view.sections.summary && (
          <section className={styles.block}>
            <h2 className={styles.blockHead}>Summary</h2>
            <p className={styles.summaryText}>{view.sections.summary.summary || view.sections.summary.offerSummary}</p>
          </section>
        )}
        <DetailsList snap={snap} />
      </div>
      <div className={styles.panelFoot}>
        <Link href={full} className={styles.viewBtn}><ExternalLink size={15} aria-hidden /> View full page</Link>
      </div>
    </aside>
  );
}
