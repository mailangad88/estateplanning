import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock, ExternalLink, FileText, Gauge, Scale, UserRound, X } from "lucide-react";
import { CASE_PHASES } from "@/lib/caseJourney";
import { QUESTIONNAIRE_STAGES } from "@/lib/intakeQuestionnaire";
import type { CaseCard, CaseJourneyView } from "@/server/services/caseBoard";
import { initials, StepTrack, TONE } from "./parts";
import styles from "./cases.module.css";

export type ListSearch = Record<string, string | undefined>;
export const PAGE_SIZE = 20;

export function listHref(sp: ListSearch, patch: ListSearch): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v && k !== "updated" && k !== "error" && k !== "ok") q.set(k, v);
  const s = q.toString();
  return s ? `/admin/cases?${s}` : "/admin/cases";
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "-");
const phaseLabel = (c: CaseCard) => (c.journey.exited ? "Closed early" : CASE_PHASES.find((p) => p.key === c.journey.phase)?.label ?? "");
const ref = (id: string) => `#${id.replace(/^case-|^lead-/, "").slice(-6).toUpperCase()}`;

/** Status dot: red when stuck, gold when urgent, green on track, grey when closed. */
function dot(c: CaseCard): [string, string] {
  if (c.journey.exited || c.journey.closed) return [styles.dotGrey, "Closed"];
  if (c.journey.stale) return [styles.dotRed, "Stuck"];
  if (c.urgent) return [styles.dotGold, "Urgent"];
  return [styles.dotGreen, "On track"];
}

export const GROUPS: Record<string, { label: string; key: (c: CaseCard) => string }> = {
  phase: { label: "Phase", key: phaseLabel },
  attorney: { label: "Attorney", key: (c) => c.lawyerName?.replace(/,?\s*Esq\.?$/i, "") ?? "No attorney" },
  paralegal: { label: "Paralegal", key: (c) => c.paralegalName ?? "No paralegal yet" },
  status: { label: "Status", key: (c) => dot(c)[1] },
};

export function CaseTable({ cards, sp, showParalegal }: { cards: CaseCard[]; sp: ListSearch; showParalegal: boolean }) {
  const group = sp.group ? GROUPS[sp.group] : undefined;
  if (group) {
    // Keep each group together across pages, groups in the order they first appear.
    const first = new Map<string, number>();
    cards.forEach((c, i) => { const k = group.key(c); if (!first.has(k)) first.set(k, i); });
    cards = [...cards].sort((a, b) => first.get(group.key(a))! - first.get(group.key(b))!);
  }
  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const shown = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const order = group ? [...new Set(shown.map(group.key))] : [""];
  const cols = showParalegal ? 8 : 7;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.caseTable}>
        <thead>
          <tr>
            <th className={styles.colRef}>Case</th>
            <th>Client</th>
            <th>Current step</th>
            <th className={styles.hideSm}>Phase</th>
            <th className={styles.hideMd}>Attorney</th>
            {showParalegal && <th className={styles.hideMd}>Paralegal</th>}
            <th className={styles.hideSm}>Progress</th>
            <th className={styles.colNum}>Days on step</th>
          </tr>
        </thead>
        <tbody>
          {cards.length === 0 && <tr><td colSpan={cols} className={styles.emptyRow}>No cases match. <Link href="/admin/cases">Clear the filters</Link></td></tr>}
          {order.map((g) => (
            <GroupRows key={g || "all"} label={group ? g : undefined} cols={cols} rows={group ? shown.filter((c) => group.key(c) === g) : shown} sp={sp} showParalegal={showParalegal} />
          ))}
        </tbody>
      </table>
      <div className={styles.pager}>
        <span>{cards.length === 0 ? "0 cases" : `${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, cards.length)} of ${cards.length}`}</span>
        <span className={styles.pagerNav}>
          {page > 1 ? <Link href={listHref(sp, { page: String(page - 1), open: undefined })} aria-label="Previous page"><ChevronLeft size={16} aria-hidden /></Link> : <span aria-hidden><ChevronLeft size={16} /></span>}
          Page {page} of {pages}
          {page < pages ? <Link href={listHref(sp, { page: String(page + 1), open: undefined })} aria-label="Next page"><ChevronRight size={16} aria-hidden /></Link> : <span aria-hidden><ChevronRight size={16} /></span>}
        </span>
      </div>
    </div>
  );
}

function GroupRows({ label, rows, cols, sp, showParalegal }: { label?: string; rows: CaseCard[]; cols: number; sp: ListSearch; showParalegal: boolean }) {
  return (
    <>
      {label && <tr className={styles.groupRow}><th colSpan={cols} scope="colgroup">{label} <span>{rows.length}</span></th></tr>}
      {rows.map((c) => {
        const [dotCls, dotLabel] = dot(c);
        const href = listHref(sp, { open: c.leadId });
        const on = sp.open === c.leadId;
        return (
          <tr key={c.leadId} className={`${styles.caseRow} ${on ? styles.caseRowOn : ""}`}>
            <td className={styles.colRef}><span className={`${styles.dot} ${dotCls}`} title={dotLabel} aria-label={dotLabel} />{ref(c.leadId)}</td>
            <td>
              <Link href={href} scroll={false} className={styles.rowLink}>{c.name}</Link>
              {c.urgent && <span className={`${styles.chip} ${styles.chipUrgent}`}>Urgent</span>}
              <span className={styles.rowSub}>{c.matter} · {c.state}</span>
            </td>
            <td>
              {c.journey.exited ? "Closed early" : c.journey.closed ? "File closed" : c.journey.current?.label}
              <span className={styles.rowSub}>Next: {c.nextAction}</span>
            </td>
            <td className={styles.hideSm}><span className={`${styles.phaseChip} ${styles[`t_${TONE[c.journey.phase] ?? "deep"}`] ?? ""}`}>{phaseLabel(c)}</span></td>
            <td className={styles.hideMd}><Person name={c.lawyerName} /></td>
            {showParalegal && <td className={styles.hideMd}>{c.paralegalName ? <Person name={c.paralegalName} para /> : <span className={styles.none}>Not assigned</span>}</td>}
            <td className={styles.hideSm}><span className={styles.bar}><span style={{ width: `${c.journey.percent}%` }} /></span><span className={styles.rowSub}>{c.journey.done} of {c.journey.total}</span></td>
            <td className={styles.colNum}>{c.journey.closed || c.journey.exited ? "-" : <span className={c.journey.stale ? styles.daysStale : undefined}>{c.journey.stale && <AlertTriangle size={12} aria-hidden />}{c.journey.daysInStep}</span>}</td>
          </tr>
        );
      })}
    </>
  );
}

function Person({ name, para }: { name?: string; para?: boolean }) {
  if (!name) return <span className={styles.none}>-</span>;
  const clean = name.replace(/,?\s*Esq\.?$/i, "");
  return <span className={styles.person}><span className={`${styles.avatar} ${para ? styles.avatarPara : ""}`}>{initials(name)}</span>{clean}</span>;
}

/** The slide-over on the right: the case at a glance, with the one action that moves it forward. */
export function CasePanel({ view, sp, closeHref }: { view: CaseJourneyView; sp: ListSearch; closeHref: string }) {
  const { card, canComplete, lead } = view;
  const j = card.journey;
  const qStage = card.questionnaire;
  const qLabel = qStage === "not_started" ? "Not started" : QUESTIONNAIRE_STAGES.find((s) => s.key === qStage)?.label;
  const paidAt = j.steps.find((s) => s.key === "paid")?.at;
  const ret = listHref(sp, { open: card.leadId });
  return (
    <aside className={styles.slideOver} aria-label={`Case ${card.name}`}>
      <div className={styles.panelBar}>
        <span>Case {ref(card.leadId)}</span>
        <Link href={`/admin/cases/${card.leadId}`} className={styles.panelIcon} title="Open the full case"><ExternalLink size={16} aria-hidden /><span className="sr-only">Open the full case</span></Link>
        <Link href={closeHref} scroll={false} className={styles.panelIcon} title="Close"><X size={18} aria-hidden /><span className="sr-only">Close</span></Link>
      </div>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>{card.name} <span>{card.matter} · {card.state}</span></h2>
        {sp.updated && <p className={styles.panelOk}>Step marked done.</p>}
        {sp.error && <p className={styles.panelErr}>{sp.error}</p>}

        <div className={styles.panelActions}>
          {canComplete ? (
            <form method="post" action={`/api/admin/cases/${card.leadId}/step`} className={styles.advance}>
              <input type="hidden" name="step" value={canComplete.key} />
              <input type="hidden" name="return" value={ret} />
              <button className={styles.advanceBtn} name="action" value="done" type="submit">Mark done: {canComplete.label}</button>
              {canComplete.skippable && <button className={styles.ghostBtn} name="action" value="skip" type="submit">Not needed</button>}
            </form>
          ) : (
            !j.closed && !j.exited && <p className={styles.panelNext}>Next: {card.nextAction}{j.current?.attorneyOnly ? " (attorney)" : ""}</p>
          )}
          <Link href={`/admin/cases/${card.leadId}`} className={styles.ghostBtn}>Full journey</Link>
          <Link href={`/admin/cases/${card.leadId}/intake`} className={styles.ghostBtn}><FileText size={14} aria-hidden /> Questionnaire</Link>
        </div>

        <div className={styles.panelTrack}><StepTrack card={card} /></div>

        <h3 className={styles.panelHead}>Details</h3>
        <dl className={styles.details}>
          <div><dt><Gauge size={15} aria-hidden /> State</dt><dd><span className={`${styles.phaseChip} ${styles[`t_${TONE[j.phase] ?? "deep"}`] ?? ""}`}>{j.exited ? "Closed early" : j.closed ? "Closed" : j.current?.label}</span></dd></div>
          <div><dt><Clock size={15} aria-hidden /> On this step</dt><dd>{j.closed || j.exited ? "-" : <span className={j.stale ? styles.daysStale : undefined}>{j.daysInStep} day{j.daysInStep === 1 ? "" : "s"}{j.stale ? ", longer than it should" : ""}</span>}</dd></div>
          <div><dt><ClipboardList size={15} aria-hidden /> Progress</dt><dd>{j.done} of {j.total} steps ({j.percent}%)</dd></div>
          <div><dt><Scale size={15} aria-hidden /> Attorney</dt><dd><Person name={card.lawyerName} /></dd></div>
          <div><dt><UserRound size={15} aria-hidden /> Paralegal</dt><dd>{card.paralegalName ? <Person name={card.paralegalName} para /> : view.canAssign ? <Link href={`/admin/cases/${card.leadId}#paralegal`}>Assign a paralegal</Link> : <span className={styles.none}>Not assigned</span>}</dd></div>
          <div><dt><FileText size={15} aria-hidden /> Questionnaire</dt><dd>{qLabel}</dd></div>
        </dl>
        <h3 className={styles.panelHead}>Dates</h3>
        <dl className={styles.details}>
          <div><dt><CalendarDays size={15} aria-hidden /> Came in</dt><dd>{fmtDate(lead.createdAt)}</dd></div>
          <div><dt><CalendarDays size={15} aria-hidden /> Fee paid</dt><dd>{fmtDate(paidAt)}</dd></div>
          <div><dt><CalendarDays size={15} aria-hidden /> On step since</dt><dd>{fmtDate(j.since)}</dd></div>
          {j.closed && <div><dt><CalendarDays size={15} aria-hidden /> Closed</dt><dd>{fmtDate(j.steps.find((s) => s.key === "closed")?.at)}</dd></div>}
        </dl>
      </div>
    </aside>
  );
}
