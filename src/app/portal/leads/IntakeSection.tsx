import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { INTAKE_ICONS } from "@/components/portal/intakeIcons";
import { QUESTIONNAIRE, QUESTIONNAIRE_STAGES } from "@/lib/intakeQuestionnaire";
import type { questionnaireBrief } from "@/server/services/questionnaire";
import styles from "./leads.module.css";

type Brief = NonNullable<Awaited<ReturnType<typeof questionnaireBrief>>>;

/**
 * The intake form on the lead's own page: where the hand-off is, how much is filled in per section, the
 * answers so far (folded), and a button into the form. Before an attorney is matched it says when it opens.
 */
export function IntakeSection({ leadId, brief, waiting }: { leadId: string; brief?: Brief; waiting?: boolean }) {
  if (!brief) {
    if (!waiting) return null;
    return (
      <section id="intake">
        <div className={styles.intakeHead}><h2>Intake form</h2></div>
        <p className={styles.iEmpty}>The intake form opens once an attorney is matched to this lead. It starts from what the website and the call already told us.</p>
      </section>
    );
  }
  const { stage, progress, answers } = brief;
  const idx = stage === "not_started" ? -1 : QUESTIONNAIRE_STAGES.findIndex((s) => s.key === stage);
  const started = !brief.prefilled;
  const cta = brief.canEdit ? (started ? "Continue intake form" : "Start intake form") : "Open intake form";
  const filled = QUESTIONNAIRE.map((s) => ({ s, rows: s.fields.filter((f) => answers[f.id]).map((f) => ({ label: f.label, value: answers[f.id] })) })).filter((x) => x.rows.length);
  return (
    <section id="intake">
      <div className={styles.intakeHead}>
        <h2>Intake form</h2>
        <Link href={`/admin/cases/${leadId}/intake`} className={styles.intakeBtn}><ClipboardList size={15} aria-hidden /> {cta}</Link>
      </div>
      <ol className={styles.iStages} aria-label="Intake hand-off">
        {QUESTIONNAIRE_STAGES.map((s, i) => (
          <li key={s.key} className={stage === "signed_off" || i < idx ? styles.iDone : i === idx ? styles.iNow : undefined} aria-current={i === idx ? "step" : undefined}>{s.label}</li>
        ))}
      </ol>
      <div className={styles.iBar} role="img" aria-label={`${progress.percent}% of required answers filled`}><span style={{ width: `${progress.percent}%` }} /></div>
      <p className={styles.iMeta}>
        {progress.percent}% of required answers · {progress.filled} of {progress.total} questions answered
        {!started && " · not saved yet, pre-filled from the website and the call"}
      </p>
      <ul className={styles.iSections}>
        {QUESTIONNAIRE.map((s) => {
          const p = progress.sections.find((x) => x.id === s.id)!;
          const Icon = INTAKE_ICONS[s.icon];
          return (
            <li key={s.id}>
              <Icon size={17} aria-hidden />
              <span>{s.title}</span>
              <em className={p.requiredLeft ? styles.iLeft : p.filled ? styles.iOk : undefined}>{p.requiredLeft ? `${p.requiredLeft} needed` : `${p.filled}/${p.total}`}</em>
            </li>
          );
        })}
      </ul>
      {filled.length > 0 && (
        <details className={styles.iAnswers}>
          <summary>Answers so far ({progress.filled})</summary>
          {filled.map(({ s, rows }) => (
            <div key={s.id}>
              <h3>{s.title}</h3>
              <dl className={styles.details}>{rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
