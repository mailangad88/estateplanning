import Link from "next/link";
import { Lock } from "lucide-react";
import { INTAKE_ICONS as ICONS } from "@/components/portal/intakeIcons";
import { QUESTIONNAIRE, QUESTIONNAIRE_STAGES, type QuestionField } from "@/lib/intakeQuestionnaire";
import { can, ForbiddenError } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { caseJourney } from "@/server/services/caseBoard";
import { questionnaireView } from "@/server/services/questionnaire";
import styles from "../../cases.module.css";
import { CaseThread } from "../../parts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake questionnaire", robots: { index: false, follow: false } };

const OK: Record<string, string> = { save: "Saved.", send: "Sent to the paralegal. They can see this case now.", ready: "Marked complete. The attorney can review it.", comment: "Comment posted." };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function Field({ f, value, disabled }: { f: QuestionField; value?: string; disabled: boolean }) {
  const wide = f.type === "textarea";
  const cls = `${styles.qField} ${wide ? styles.qWide : ""} ${f.required && !value ? styles.qEmpty : ""}`;
  const label = <>{f.label}{f.required && <span className={styles.qReq} aria-hidden> *</span>}</>;
  const opts = f.type === "yesno" ? ["Yes", "No", "Not sure"] : f.options;
  return (
    <label className={cls}>
      <span>{label}</span>
      {f.type === "textarea" ? (
        <textarea name={f.id} defaultValue={value ?? ""} disabled={disabled} required={false} maxLength={4000} />
      ) : opts ? (
        <select name={f.id} defaultValue={value ?? ""} disabled={disabled}>
          <option value="">Choose…</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={f.type === "date" ? "date" : "text"} name={f.id} defaultValue={value ?? ""} disabled={disabled} maxLength={4000} />
      )}
      {f.hint && <span className={styles.qFieldHint}>{f.hint}</span>}
    </label>
  );
}

type Search = { ok?: string; error?: string };

export default async function IntakeQuestionnairePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_case_board")) return <p>The questionnaire is for attorneys, paralegals and the office.</p>;
  const { id } = await params;
  const sp = await searchParams;
  const db = scopedDb(await getDb(), actor);
  let q, cv;
  try {
    cv = await caseJourney(db, actor, id);
    q = await questionnaireView(db, actor, id);
  } catch (err) {
    if (err instanceof ForbiddenError || (err instanceof Error && /not found/i.test(err.message))) {
      return <div className={styles.board}><p><Link href="/admin/cases">← Cases</Link></p><p>This case is not assigned to you, or it does not exist.</p></div>;
    }
    throw err;
  }
  const { card, paralegalChoices } = cv;
  const stageIndex = q.stage === "not_started" ? 0 : QUESTIONNAIRE_STAGES.findIndex((s) => s.key === q.stage);
  const isAttorneySide = actor.role !== "paralegal";
  const people = cv.people;

  return (
    <div className={styles.board}>
      <p className={styles.back}><Link href="/admin/cases">← Cases</Link> · <Link href={`/admin/cases/${card.leadId}`}>Case journey</Link> · <Link href={`/portal/leads/${card.leadId}#intake`}>Lead page</Link></p>
      {sp.error && <p className={`${styles.flash} ${styles.flashErr}`} role="alert">{sp.error}</p>}
      {sp.ok && OK[sp.ok] && <p className={`${styles.flash} ${styles.flashOk}`} role="status">{OK[sp.ok]}</p>}

      <header className={styles.caseHead} style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <h1>Intake questionnaire · {card.name}</h1>
          <p className={styles.facts}>
            <span>{card.matter} · {card.state}</span>
            <span>Attorney <b>{card.lawyerName ?? "Not assigned"}</b></span>
            <span>Paralegal <b>{card.paralegalName ?? "None yet"}</b></span>
          </p>
          <ol className={styles.qStages} aria-label="Questionnaire hand-off" style={{ marginTop: 16 }}>
            {QUESTIONNAIRE_STAGES.map((s, i) => (
              <li key={s.key} className={`${styles.qStage} ${i < stageIndex || q.stage === "signed_off" ? styles.qDone : i === stageIndex ? styles.qNow : ""}`} aria-current={i === stageIndex ? "step" : undefined}>{s.label}</li>
            ))}
          </ol>
          <div className={styles.qBar} role="img" aria-label={`${q.progress.percent}% of required answers filled`}><span style={{ width: `${q.progress.percent}%` }} /></div>
          <p className={styles.stepHint}>
            {q.progress.percent}% of required answers · {q.progress.filled} of {q.progress.total} fields filled
            {q.record?.sentAt && <> · sent {when(q.record.sentAt)}{q.record.sentBy && people[q.record.sentBy] ? ` by ${people[q.record.sentBy]}` : ""}</>}
            {q.record?.readyAt && <> · marked complete {when(q.record.readyAt)}</>}
            {q.prefilled && " · started from what intake already knows"}
          </p>
          <ul className={styles.qNav} aria-label="Sections">
            {QUESTIONNAIRE.map((s) => {
              const p = q.progress.sections.find((x) => x.id === s.id)!;
              return (
                <li key={s.id}><a href={`#q-${s.id}`} className={p.requiredLeft === 0 && p.filled > 0 ? styles.qNavDone : undefined}>
                  {s.title} <span className={p.requiredLeft ? styles.qNavLeft : undefined}>{p.requiredLeft ? `${p.requiredLeft} needed` : `${p.filled}/${p.total}`}</span>
                </a></li>
              );
            })}
          </ul>
        </div>
      </header>

      {q.stage === "signed_off" && <p className={styles.qLocked}><Lock size={14} aria-hidden /> Signed off by the attorney. The questionnaire is locked; changes go in the case thread.</p>}

      <div className={styles.layout}>
        <div>
          <form method="post" action={`/api/admin/cases/${card.leadId}/intake`}>
            <input type="hidden" name="has_answers" value={q.canEdit ? "1" : "0"} />
            {QUESTIONNAIRE.map((s) => {
              const Icon = ICONS[s.icon];
              const p = q.progress.sections.find((x) => x.id === s.id)!;
              return (
                <section key={s.id} id={`q-${s.id}`} className={styles.qSection}>
                  <div className={styles.qSectionHead}>
                    <span className={styles.qIcon}><Icon size={20} aria-hidden /></span>
                    <div><h2>{s.title}</h2><p>{s.blurb}</p></div>
                    <span className={`${styles.qCount} ${p.requiredLeft ? styles.qNavLeft : ""}`}>{p.filled}/{p.total}</span>
                  </div>
                  <div className={styles.qFields}>{s.fields.map((f) => <Field key={f.id} f={f} value={q.answers[f.id]} disabled={!q.canEdit} />)}</div>
                </section>
              );
            })}

            {(q.canEdit || q.canSend) && (
              <div className={styles.qActions}>
                {q.canEdit && <button className="button small secondary" name="intent" value="save" type="submit">Save</button>}
                {q.canSend && isAttorneySide && (
                  <>
                    <span className={styles.qActionsLabel}>Send to</span>
                    <select name="paralegalId" defaultValue={card.paralegalId ?? paralegalChoices[0]?.id ?? ""} aria-label="Paralegal">
                      {paralegalChoices.length === 0 && <option value="">No paralegals at this firm yet</option>}
                      {paralegalChoices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="text" name="note" maxLength={2000} placeholder="Note for the paralegal (optional)" aria-label="Note for the paralegal" />
                    <button className="button small" name="intent" value="send" type="submit" disabled={paralegalChoices.length === 0}>{q.record?.sentAt ? "Save and resend" : "Save and send to paralegal"}</button>
                  </>
                )}
                {q.canEdit && q.stage === "paralegal" && (
                  <button className="button small" name="intent" value="ready" type="submit" title={q.progress.requiredLeft ? "Fill in every required answer first" : undefined}>
                    Mark complete, ready for attorney{q.progress.requiredLeft ? ` (${q.progress.requiredLeft} left)` : ""}
                  </button>
                )}
                {q.stage === "ready_for_review" && isAttorneySide && (
                  <span className={styles.qActionsLabel}>Ready for you. Sign it off with <Link href={`/admin/cases/${card.leadId}`}>Attorney review</Link> on the case journey.</span>
                )}
              </div>
            )}
          </form>
        </div>
        <aside className={styles.side}>
          <CaseThread comments={q.comments} leadId={card.leadId} viewerId={actor.userId} back="intake" />
          <section className={styles.panel}>
            <h2>How the hand-off works</h2>
            <p>1. The attorney fills this in during or after the call and sends it to a paralegal. Only that paralegal can see the case.</p>
            <p>2. The paralegal completes it, collects documents and marks it complete. That ticks off "Info + documents gathered".</p>
            <p>3. The attorney signs it off with the Attorney review step, then the plan is signed, delivered and the file closed.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
