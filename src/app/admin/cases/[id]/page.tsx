import Link from "next/link";
import { AlertTriangle, Check, Circle, Minus, X } from "lucide-react";
import { CASE_PHASES } from "@/lib/caseJourney";
import { can, ForbiddenError } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { caseJourney } from "@/server/services/caseBoard";
import { caseComments } from "@/server/services/questionnaire";
import { caseCommission } from "@/server/services/commissions";
import { money } from "@/lib/commission";
import { questionnaireProgress, questionnaireStage, QUESTIONNAIRE_STAGES } from "@/lib/intakeQuestionnaire";
import styles from "../cases.module.css";
import { CaseThread, TONE } from "../parts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case journey", robots: { index: false, follow: false } };

const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function Ring({ percent, done, total }: { percent: number; done: number; total: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <svg className={styles.ring} viewBox="0 0 104 104" role="img" aria-label={`${percent}% done: ${done} of ${total} steps`}>
      <circle className={styles.ringBg} cx="52" cy="52" r={r} fill="none" strokeWidth="10" />
      <circle className={styles.ringFg} cx="52" cy="52" r={r} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 52 52)" />
      <text className={styles.ringText} x="52" y="54" textAnchor="middle">{percent}%</text>
      <text className={styles.ringSub} x="52" y="70" textAnchor="middle">{done} of {total} steps</text>
    </svg>
  );
}

type Search = { updated?: string; assigned?: string; ok?: string; error?: string };

export default async function CaseJourneyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_case_board")) return <p>The case board is for attorneys, paralegals and firm admins.</p>;
  const { id } = await params;
  const sp = await searchParams;
  let view;
  const db = scopedDb(await getDb(), actor);
  try {
    view = await caseJourney(db, actor, id);
  } catch (err) {
    if (err instanceof ForbiddenError || (err instanceof Error && /not found/i.test(err.message))) {
      return <div className={styles.board}><p><Link href="/admin/cases">← Cases</Link></p><p>This case is not assigned to you, or it does not exist.</p></div>;
    }
    throw err;
  }
  const { card, canComplete, canUndo, canAssign, paralegalChoices, people } = view;
  const comments = await caseComments(db, actor, card.leadId);
  const commission = await caseCommission(db, actor, card.leadId);
  const qStage = questionnaireStage(view.lead);
  const qProgress = view.lead.questionnaire ? questionnaireProgress(view.lead.questionnaire.answers) : undefined;
  const qLabel = qStage === "not_started" ? "Not started" : QUESTIONNAIRE_STAGES.find((s) => s.key === qStage)?.label;
  const j = card.journey;
  const phaseIndex = CASE_PHASES.findIndex((p) => p.key === j.phase);
  const updatedLabel = sp.updated ? j.steps.find((s) => s.key === sp.updated)?.label : undefined;

  return (
    <div className={styles.board}>
      <p className={styles.back}><Link href="/admin/cases">← Cases</Link> · <Link href={`/portal/leads/${card.leadId}`}>Lead page</Link></p>
      {sp.error && <p className={`${styles.flash} ${styles.flashErr}`} role="alert">{sp.error}</p>}
      {updatedLabel && <p className={`${styles.flash} ${styles.flashOk}`} role="status">Updated: {updatedLabel}</p>}
      {sp.assigned && <p className={`${styles.flash} ${styles.flashOk}`} role="status">Paralegal updated.</p>}
      {sp.ok === "comment" && <p className={`${styles.flash} ${styles.flashOk}`} role="status">Comment posted.</p>}
      {sp.ok?.startsWith("commission_") && <p className={`${styles.flash} ${styles.flashOk}`} role="status">{sp.ok === "commission_paid" ? "Commission marked paid." : sp.ok === "commission_unpaid" ? "Payout record removed." : "Commission rule saved."}</p>}

      <header className={styles.caseHead}>
        <Ring percent={j.percent} done={j.done} total={j.total} />
        <div>
          <h1>{card.name}</h1>
          <p className={styles.facts}>
            <span>{card.matter} · {card.state}</span>
            <span>Attorney <b>{card.lawyerName ?? "Not assigned"}</b></span>
            <span>Paralegal <b>{card.paralegalName ?? "None yet"}</b></span>
          </p>
          <div className={styles.nowBanner}>
            {card.urgent && <span className={`${styles.chip} ${styles.chipUrgent}`}>Urgent</span>}
            {j.exited ? (
              <span className={`${styles.chip} ${styles.chipStale}`}>Closed early: {j.exited.reason}</span>
            ) : j.closed ? (
              <span className={`${styles.chip} ${styles.chipDone}`}>Case closed</span>
            ) : (
              <>
                <span>Now on <b>{j.current?.label}</b> for {j.daysInStep} {j.daysInStep === 1 ? "day" : "days"}</span>
                {j.stale && <span className={`${styles.chip} ${styles.chipStale}`}><AlertTriangle size={11} aria-hidden /> Stuck: over {j.current?.staleAfterDays} days</span>}
                <span className={styles.stepHint}>Next: {card.nextAction}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <ol className={styles.phaseStrip} aria-label="Phases">
        {CASE_PHASES.map((p, i) => {
          const steps = j.steps.filter((s) => s.phase === p.key);
          const finished = steps.filter((s) => s.state === "done" || s.state === "skipped").length;
          const state = j.closed || (phaseIndex >= 0 && i < phaseIndex) ? styles.phaseDone : i === phaseIndex ? styles.phaseNow : "";
          return (
            <li key={p.key} className={`${styles.phaseCell} ${styles[`t_${p.tone}`]} ${state}`} aria-current={i === phaseIndex ? "step" : undefined}>
              {p.label}<small>{finished} of {steps.length}</small>
            </li>
          );
        })}
      </ol>

      <div className={styles.layout}>
        <ol className={styles.timeline} aria-label="Case journey">
          {CASE_PHASES.map((p) => (
            <li key={p.key} style={{ listStyle: "none" }}>
              <p className={`${styles.phaseLabel} ${styles[`t_${p.tone}`]}`}>{p.label}</p>
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {j.steps.filter((s) => s.phase === p.key).map((s) => {
                  const cls = [
                    styles.step,
                    styles[`t_${TONE[s.phase]}`],
                    s.state === "done" && styles.stepDone,
                    s.state === "skipped" && styles.stepSkipped,
                    s.state === "current" && (j.stale ? styles.stepStale : styles.stepCurrent),
                    s.state === "upcoming" && styles.stepUpcoming,
                    s.state === "stopped" && styles.stepStopped,
                  ].filter(Boolean).join(" ");
                  const isNext = canComplete?.key === s.key;
                  return (
                    <li key={s.key} className={cls} aria-current={s.state === "current" ? "step" : undefined}>
                      <span className={styles.node} aria-hidden>
                        {s.state === "done" ? <Check size={16} strokeWidth={3} /> : s.state === "skipped" ? <Minus size={16} /> : s.state === "stopped" ? <X size={16} /> : s.state === "current" ? (j.stale ? <AlertTriangle size={15} /> : <Circle size={12} fill="currentColor" />) : <Circle size={10} />}
                      </span>
                      <div className={styles.stepBody}>
                        <div className={styles.stepTitle}>
                          {s.label}
                          {s.attorneyOnly && <span className={`${styles.chip} ${styles.chipDays}`}>Attorney</span>}
                          {s.state === "skipped" && <span className={`${styles.chip} ${styles.chipDays}`}>Not needed</span>}
                          {s.state === "current" && <span className={`${styles.chip} ${j.stale ? styles.chipStale : styles.chipDays}`}>{j.daysInStep}d</span>}
                        </div>
                        <div className={styles.stepHint}>{s.hint}</div>
                        {s.at && (s.state === "done" || s.state === "skipped") && (
                          <div className={styles.stepWhen}>{when(s.at)}{s.by && people[s.by] ? ` · ${people[s.by]}` : ""}</div>
                        )}
                        {s.note && <div className={styles.stepNote}>{s.note}</div>}
                        {isNext && (
                          <form className={styles.action} method="post" action={`/api/admin/cases/${card.leadId}/step`}>
                            <input type="hidden" name="step" value={s.key} />
                            <input type="text" name="note" maxLength={500} placeholder="Note (optional)" aria-label={`Note for ${s.label}`} />
                            <button className="button small" name="action" value="done" type="submit">Mark done</button>
                            {canComplete?.skippable && <button className="button small secondary" name="action" value="skip" type="submit">Not needed</button>}
                          </form>
                        )}
                        {s.state === "current" && !isNext && s.attorneyOnly && actor.role === "paralegal" && (
                          <div className={styles.stepWhen}>Waiting on the attorney to sign this off.</div>
                        )}
                        {canUndo?.key === s.key && (
                          <form method="post" action={`/api/admin/cases/${card.leadId}/step`}>
                            <input type="hidden" name="step" value={s.key} />
                            <button className={styles.linkButton} name="action" value="undo" type="submit">Undo this step</button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>

        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2>Intake questionnaire</h2>
            <p><span className={`${styles.chip} ${qStage === "signed_off" ? styles.chipDone : styles.chipQ}`}>{qLabel}</span></p>
            {qProgress && <><div className={styles.qBar}><span style={{ width: `${qProgress.percent}%` }} /></div><p className={styles.stepHint}>{qProgress.percent}% of required answers</p></>}
            <p><Link className="button small" href={`/admin/cases/${card.leadId}/intake`}>{qStage === "not_started" ? "Start the questionnaire" : "Open the questionnaire"}</Link></p>
          </section>
          {commission && (
            <section className={styles.panel} id="commission">
              <h2>Paralegal commission</h2>
              {!commission.hasParalegal ? <p className={styles.stepHint}>Assign a paralegal first.</p> : (
                <>
                  <div className={styles.commissionAmount}>{money(commission.line.amountCents)}</div>
                  <p className={styles.stepHint}>
                    {commission.line.mode === "flat" ? "Flat amount" : `${commission.line.percent}% of ${commission.line.feeCents ? money(commission.line.feeCents) : "the fee (none on file yet)"}`}
                    {commission.line.isDefault ? " · firm default" : ""}{commission.line.feeSource === "package" ? " · fee from the package" : ""}
                  </p>
                  <p><span className={`${styles.chip} ${commission.line.status === "paid" ? styles.chipPaid : commission.line.status === "earned" ? styles.chipEarned : styles.chipPending}`}>
                    {commission.line.status === "paid" ? `Paid ${new Date(commission.line.paidAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : commission.line.status === "earned" ? "Earned, not paid" : "Pending until the file is closed"}
                  </span></p>
                  {commission.line.note && <p className={styles.stepNote}>{commission.line.note}</p>}
                </>
              )}
              {commission.canManage && commission.hasParalegal && (
                <form className={styles.ruleForm} method="post" action={`/api/admin/cases/${card.leadId}/commission`}>
                  <input type="hidden" name="intent" value="rule" />
                  <div className={styles.row}>
                    <label><input type="radio" name="mode" value="default" defaultChecked={commission.line.isDefault} /> Firm default</label>
                  </div>
                  <div className={styles.row}>
                    <label><input type="radio" name="mode" value="percent" defaultChecked={!commission.line.isDefault && commission.line.mode === "percent"} /> Percent</label>
                    <input type="number" name="percent" min={0} max={50} step={0.5} defaultValue={commission.line.percent ?? ""} aria-label="Percent of the fee" />%
                  </div>
                  <div className={styles.row}>
                    <label><input type="radio" name="mode" value="flat" defaultChecked={!commission.line.isDefault && commission.line.mode === "flat"} /> Flat $</label>
                    <input type="number" name="flat" min={0} max={10000} step={1} defaultValue={commission.line.mode === "flat" ? commission.line.amountCents / 100 : ""} aria-label="Flat amount in dollars" />
                  </div>
                  <input type="text" name="note" maxLength={500} placeholder="Note (optional)" aria-label="Commission note" />
                  <button className="button small secondary" type="submit">Save rule</button>
                </form>
              )}
              {commission.canPay && commission.line.status === "earned" && commission.line.amountCents > 0 && (
                <form method="post" action={`/api/admin/cases/${card.leadId}/commission`} style={{ marginTop: 8 }}>
                  <button className="button small" name="intent" value="paid" type="submit">Mark {money(commission.line.amountCents)} paid</button>
                </form>
              )}
              {commission.canPay && commission.line.status === "paid" && (
                <form method="post" action={`/api/admin/cases/${card.leadId}/commission`} style={{ marginTop: 8 }}>
                  <button className={styles.linkButton} name="intent" value="unpaid" type="submit">Undo payout record</button>
                </form>
              )}
              <p className={styles.stepHint} style={{ marginTop: 8 }}><Link href="/admin/commissions">All commissions</Link></p>
            </section>
          )}
          <CaseThread comments={comments} leadId={card.leadId} viewerId={actor.userId} />
          <section className={styles.panel}>
            <h2>Paralegal</h2>
            {canAssign ? (
              <form method="post" action={`/api/admin/cases/${card.leadId}/paralegal`}>
                <label className={styles.stepHint} htmlFor="paralegalId">Only the paralegal you pick can see this case.</label>
                <select id="paralegalId" name="paralegalId" defaultValue={card.paralegalId ?? ""}>
                  <option value="">No paralegal</option>
                  {paralegalChoices.map((p) => <option key={p.id} value={p.id}>{p.name}{p.supportsAttorney ? "" : " (works with another attorney)"}</option>)}
                </select>
                <button className="button small" type="submit">Save</button>
              </form>
            ) : (
              <p>{card.paralegalName ?? "None yet"}. The attorney or the office assigns paralegals.</p>
            )}
          </section>
          <section className={styles.panel}>
            <h2>How this works</h2>
            <p>Steps go in order. Ticking one off records who and when in the case's audit log.</p>
            <p>Pipeline steps (consult, retainer, payment) also move on their own when the booking, e-sign or payment flow records them.</p>
            <p>Attorney review (which also signs off the questionnaire) and closing the file are for the attorney only. Every package includes one round of client revisions.</p>
          </section>
          <section className={styles.panel}>
            <h2>Case file</h2>
            <p>Intake, documents, comments, consults and the retainer live on the <Link href={`/portal/leads/${card.leadId}`}>full case file</Link>.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
