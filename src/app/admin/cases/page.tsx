import Link from "next/link";
import { AlertTriangle, Briefcase, CheckCircle2, UserX } from "lucide-react";
import { CASE_PHASES, JOURNEY_STEPS } from "@/lib/caseJourney";
import { can, ForbiddenError } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { caseBoard, type CaseBoardFilters, type CaseCard } from "@/server/services/caseBoard";
import styles from "./cases.module.css";
import { initials, StepTrack, TONE } from "./parts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cases", robots: { index: false, follow: false } };

type Search = { lawyer?: string; paralegal?: string; stuck?: string; closed?: string };

function hrefWith(sp: Search, patch: Partial<Search>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/admin/cases?${s}` : "/admin/cases";
}

const Q_CHIP: Record<string, string> = { attorney: "Questionnaire: attorney filling in", paralegal: "Questionnaire: with paralegal", ready_for_review: "Questionnaire: ready for attorney" };

function Card({ card, showParalegal }: { card: CaseCard; showParalegal: boolean }) {
  const j = card.journey;
  return (
    <Link href={`/admin/cases/${card.leadId}`} className={`${styles.card} ${j.stale ? styles.cardStale : ""} ${styles[`t_${TONE[j.phase] ?? "deep"}`] ?? ""}`}>
      <div className={styles.cardTop}>
        <div>
          <span className={styles.cardName}>{card.name}</span>
          <span className={styles.cardMeta}>{card.matter} · {card.state}</span>
        </div>
        {card.urgent && <span className={`${styles.chip} ${styles.chipUrgent}`}>Urgent</span>}
      </div>
      <StepTrack card={card} />
      <p className={styles.now}>
        <span>{j.exited ? "Closed early" : j.closed ? "Closed" : j.current?.label}</span>
        {!j.closed && !j.exited && (
          <span className={`${styles.chip} ${j.stale ? styles.chipStale : styles.chipDays}`}>
            {j.stale && <AlertTriangle size={11} aria-hidden />}{j.daysInStep}d
          </span>
        )}
        {j.closed && <span className={`${styles.chip} ${styles.chipDone}`}>{j.percent}%</span>}
      </p>
      <p className={styles.next}>Next: {card.nextAction}</p>
      {Q_CHIP[card.questionnaire] && <p className={styles.next}><span className={`${styles.chip} ${styles.chipQ}`}>{Q_CHIP[card.questionnaire]}</span></p>}
      <div className={styles.people}>
        <span className={styles.person} title="Attorney"><span className={styles.avatar}>{initials(card.lawyerName)}</span>{card.lawyerName?.replace(/,?\s*Esq\.?$/i, "")}</span>
        {showParalegal && (card.paralegalName ? (
          <span className={styles.person} title="Paralegal"><span className={`${styles.avatar} ${styles.avatarPara}`}>{initials(card.paralegalName)}</span>{card.paralegalName}</span>
        ) : (
          <span className={styles.person}><span className={`${styles.avatar} ${styles.avatarNone}`}>+</span>No paralegal</span>
        ))}
      </div>
    </Link>
  );
}

export default async function CasesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_case_board")) return <p>The case board is for attorneys, paralegals and firm admins.</p>;
  const sp = await searchParams;
  const filters: CaseBoardFilters = {
    lawyerId: sp.lawyer || undefined,
    paralegalId: actor.role === "paralegal" ? undefined : sp.paralegal || undefined,
    stuck: sp.stuck === "1",
    showClosed: sp.closed === "1",
  };
  let board;
  try {
    board = await caseBoard(scopedDb(await getDb(), actor), actor, filters);
  } catch (err) {
    if (err instanceof ForbiddenError) return <p>{err.message}</p>;
    throw err;
  }
  const isPara = actor.role === "paralegal";
  const byPhase = Object.fromEntries(board.columns.map((c) => [c.key, c.cards.length]));
  const allPhases = CASE_PHASES.map((p) => ({ ...p, n: byPhase[p.key] ?? 0 }));
  const shownTotal = board.columns.reduce((n, c) => n + c.cards.length, 0);

  return (
    <div className={styles.board}>
      <p className={styles.back}><Link href="/portal">← Portal</Link>{can(actor, "view_pipeline") && <> · <Link href="/admin/pipeline">Lead pipeline</Link></>}</p>
      <div className={styles.head}>
        <div>
          <h1>{isPara ? "Your cases" : "Cases"}</h1>
          <p className={styles.lede}>
            {isPara ? "Only the cases assigned to you." : actor.role === "attorney" ? "Your accepted cases, from first call to closed file." : actor.role === "firm_admin" ? "Your firm's accepted cases, from first call to closed file." : "Every accepted case, from first call to closed file."}
            {" "}{JOURNEY_STEPS.length} steps, in six phases.
          </p>
        </div>
      </div>

      <ul className={styles.tiles} aria-label="Case totals">
        <li><Link className={`${styles.tile} ${!filters.stuck && !filters.paralegalId ? styles.tileOn : ""}`} href={hrefWith(sp, { stuck: undefined, paralegal: undefined })}><span className={styles.tileIcon}><Briefcase size={18} aria-hidden /></span><span><span className={styles.tileNum}>{board.counts.active}</span><span className={styles.tileLabel}>Open cases</span></span></Link></li>
        <li><Link className={`${styles.tile} ${styles.tileWarn} ${filters.stuck ? styles.tileOn : ""}`} href={hrefWith(sp, { stuck: filters.stuck ? undefined : "1" })}><span className={styles.tileIcon}><AlertTriangle size={18} aria-hidden /></span><span><span className={styles.tileNum}>{board.counts.stuck}</span><span className={styles.tileLabel}>Stuck too long</span></span></Link></li>
        {!isPara && <li><Link className={`${styles.tile} ${styles.tileWarn} ${filters.paralegalId === "none" ? styles.tileOn : ""}`} href={hrefWith(sp, { paralegal: filters.paralegalId === "none" ? undefined : "none" })}><span className={styles.tileIcon}><UserX size={18} aria-hidden /></span><span><span className={styles.tileNum}>{board.counts.unassigned}</span><span className={styles.tileLabel}>No paralegal yet</span></span></Link></li>}
        <li><Link className={`${styles.tile} ${styles.tileGood} ${filters.showClosed ? styles.tileOn : ""}`} href={hrefWith(sp, { closed: filters.showClosed ? undefined : "1" })}><span className={styles.tileIcon}><CheckCircle2 size={18} aria-hidden /></span><span><span className={styles.tileNum}>{board.counts.closed}</span><span className={styles.tileLabel}>Closed</span></span></Link></li>
      </ul>

      <div className={styles.journeyBar} aria-label="Cases by phase">
        {allPhases.filter((p) => (p.key !== "closed" || filters.showClosed) && (p.key !== "lead" || p.n > 0)).map((p) => (
          <a key={p.key} href={`#phase-${p.key}`} className={`${styles.journeySeg} ${styles[`t_${p.tone}`]} ${p.n === 0 ? styles.journeyEmpty : ""}`} style={{ flexGrow: Math.max(1, p.n) }}>
            <strong>{p.n}</strong><span>{p.label}</span>
          </a>
        ))}
      </div>
      <p className={styles.journeyArrow} aria-hidden><span>Lead in</span><span>→</span><span>Closed</span></p>

      <form className={styles.filters} method="get" action="/admin/cases">
        <label>
          Attorney
          <select name="lawyer" defaultValue={filters.lawyerId ?? ""}>
            <option value="">All attorneys</option>
            {board.lawyers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {!isPara && (
          <label>
            Paralegal
            <select name="paralegal" defaultValue={filters.paralegalId ?? ""}>
              <option value="">Everyone</option>
              <option value="none">No paralegal yet</option>
              {board.paralegals.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <label className={styles.check}><input type="checkbox" name="stuck" value="1" defaultChecked={filters.stuck} /> Stuck only</label>
        <label className={styles.check}><input type="checkbox" name="closed" value="1" defaultChecked={filters.showClosed} /> Show closed</label>
        <button className="button small" type="submit">Filter</button>
        <Link href="/admin/cases">Clear</Link>
      </form>

      {board.counts.total === 0 ? (
        <p className={styles.emptyCol}>{isPara ? "No cases are assigned to you yet. An attorney or the office assigns them from a case page." : "No accepted cases yet. Cases appear here once an attorney accepts a lead."}</p>
      ) : (
        <div className={styles.columns} style={{ ["--cols" as string]: board.columns.length }}>
          {board.columns.map((col) => (
            <section key={col.key} id={`phase-${col.key}`} className={`${styles.column} ${styles[`t_${col.tone}`]}`} aria-label={`${col.label}: ${col.cards.length} cases`}>
              <div className={styles.columnHead}><h2>{col.label}</h2><span className={styles.columnCount}>{col.cards.length}</span></div>
              {col.cards.length === 0 ? <p className={styles.emptyCol}>Nothing here</p> : (
                <ul className={styles.cards}>{col.cards.map((c) => <li key={c.leadId}><Card card={c} showParalegal={!isPara} /></li>)}</ul>
              )}
            </section>
          ))}
        </div>
      )}

      {board.exited.length > 0 && (
        <section className={styles.exited}>
          <h2>Closed early</h2>
          <ul className={styles.exitedList}>{board.exited.map((c) => <li key={c.leadId}><Card card={c} showParalegal={!isPara} /></li>)}</ul>
        </section>
      )}
      <p className={styles.note}>{shownTotal} shown. First name and last initial only; open a case for the full journey. A red edge means the case has sat on its step longer than it should. Every view of this page is recorded in the audit log.</p>
    </div>
  );
}
