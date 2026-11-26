import { CASE_PHASES } from "@/lib/caseJourney";
import type { Comment } from "@/server/types";
import type { CaseCard } from "@/server/services/caseBoard";
import styles from "./cases.module.css";

export const initials = (name?: string) =>
  (name ?? "").replace(/,?\s*Esq\.?$/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export const TONE = Object.fromEntries(CASE_PHASES.map((p) => [p.key, p.tone])) as Record<string, string>;

/** One segment per journey step, coloured by its phase. */
export function StepTrack({ card }: { card: CaseCard }) {
  const j = card.journey;
  return (
    <div className={styles.track} role="img" aria-label={`Step ${Math.min(j.currentIndex + 1, j.total)} of ${j.total}: ${j.current?.label ?? "closed"}`}>
      {j.steps.map((s) => (
        <span
          key={s.key}
          title={s.label}
          className={[
            styles.dot,
            styles[`t_${TONE[s.phase]}`],
            s.state === "done" && styles.dotDone,
            s.state === "skipped" && styles.dotSkipped,
            s.state === "current" && styles.dotCurrent,
            s.state === "current" && j.stale && styles.dotStale,
            s.state === "stopped" && styles.dotStopped,
          ].filter(Boolean).join(" ")}
        />
      ))}
    </div>
  );
}


const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The case's comment thread (firm-visible) with a box to add to it. */
export function CaseThread({ comments, leadId, viewerId, back }: { comments: Comment[]; leadId: string; viewerId: string; back?: "intake" }) {
  return (
    <section className={styles.panel} id="thread" aria-label="Case thread">
      <h2>Case thread</h2>
      {comments.length === 0 ? <p className={styles.stepHint}>No comments yet. Notes here are seen by the attorney, the paralegal and the office, never the client.</p> : (
        <ol className={styles.thread}>
          {comments.map((c) => (
            <li key={c.id} className={`${styles.msg} ${c.authorId === viewerId ? styles.msgMine : ""}`}>
              <span className={`${styles.avatar} ${c.authorId === viewerId ? styles.avatarPara : ""}`} aria-hidden>{initials(c.authorName)}</span>
              <div>
                <div className={styles.msgMeta}><b>{c.authorName}</b> · {stamp(c.createdAt)}</div>
                <div className={styles.msgBody}>{c.body}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form className={styles.threadForm} method="post" action={`/api/admin/cases/${leadId}/comments${back ? `?back=${back}` : ""}`}>
        <label className={styles.stepHint} htmlFor={`comment-${leadId}`}>Add a comment for the case team</label>
        <textarea id={`comment-${leadId}`} name="body" required maxLength={10000} placeholder="e.g. Client is sending the deed by Friday" />
        <button className="button small" type="submit">Post comment</button>
      </form>
    </section>
  );
}
