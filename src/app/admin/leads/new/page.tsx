import { firm, servedStates } from "@/config/firm";
import { recordingNoticeText, noRelationshipText } from "@/lib/consent";
import { HEARD_FROM_OPTIONS } from "@/lib/heardFrom";
import { loadDesk } from "../data";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";

export default async function NewPhoneCall({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const sp = await searchParams;
  // Development has no SERVED_STATES (placeholder "XX"); the first launch serves Illinois.
  const served = servedStates().filter((x) => x !== "XX");
  const states = served.length ? served : ["IL"];
  return (
    <>
      <p className={styles.kicker}>Daily</p>
      <h1>New phone call</h1>
      {sp.error && <p className={styles.alert} role="alert">{sp.error}</p>}
      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <h2>Who called</h2>
          <p className={styles.sub}>Fill in what you have while you talk. Name and phone are enough to save; the rest helps match them with the right attorney.</p>
          <form className={styles.form} method="post" action="/api/admin/leads">
            <div className={styles.formRow}>
              <label>First name<input name="firstName" required maxLength={80} autoComplete="off" /></label>
              <label>Last name<input name="lastName" maxLength={80} autoComplete="off" /></label>
            </div>
            <div className={styles.formRow}>
              <label>Phone<input name="phone" required inputMode="tel" placeholder="630 555 0123" /></label>
              <label>Email (optional)<input name="email" type="email" maxLength={200} /></label>
            </div>
            <div className={styles.formRow}>
              <label>
                State
                <select name="state" defaultValue={states[0] ?? "IL"}>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                  {["IN", "WI", "MO", "IA", "MI"].filter((s) => !states.includes(s)).map((s) => <option key={s} value={s}>{s} (outside our area)</option>)}
                </select>
              </label>
              <label>County<input name="county" maxLength={80} placeholder="Kane" /></label>
            </div>
            <div className={styles.formRow}>
              <label>
                What they need
                <select name="matterType" defaultValue="">
                  <option value="">Not sure yet</option>
                  <option value="new_plan">A new plan (will, trust)</option>
                  <option value="update_plan">Update an existing plan</option>
                  <option value="after_death">Someone has died (probate, trust administration)</option>
                  <option value="elder_care">Care for an older parent</option>
                </select>
              </label>
              <label>
                Timing
                <select name="urgency" defaultValue="">
                  <option value="">Not asked</option>
                  <option value="exploring">Just exploring</option>
                  <option value="this_month">This month</option>
                  <option value="health_event">Health event coming up</option>
                  <option value="recent_death">Recent death</option>
                </select>
              </label>
            </div>
            <div className={styles.formRow}>
              <label>
                Relationship
                <select name="maritalStatus" defaultValue="">
                  <option value="">Not asked</option>
                  {["single", "married", "partnered", "divorced", "widowed"].map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
                </select>
              </label>
              <label>
                Children
                <select name="children" defaultValue="">
                  <option value="">Not asked</option>
                  <option value="none">None</option>
                  <option value="minors">Under 18</option>
                  <option value="adults">Adults</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label>
                Owns a home
                <select name="ownsHome" defaultValue=""><option value="">Not asked</option><option value="yes">Yes</option><option value="no">No</option></select>
              </label>
            </div>
            <label>
              How they heard about us
              <select name="heardFrom" defaultValue="">
                <option value="">Not asked</option>
                {HEARD_FROM_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </label>
            <label>What they said<textarea name="notes" maxLength={2000} placeholder="In their words: what's going on, who's involved, any dates" /></label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: 8, fontWeight: 400 }}>
              <input type="checkbox" name="smsConsent" value="yes" /> They said yes to texts about their inquiry at this number
            </label>
            <div><button className={styles.btn} type="submit">Save phone lead</button></div>
          </form>
        </section>
        <aside className={styles.card}>
          <h2>Read on the call</h2>
          <p className={styles.notice}>{recordingNoticeText()}</p>
          <p className={styles.notice}>{noRelationshipText()}</p>
          <h3 style={{ fontSize: "0.95rem", margin: "16px 0 4px" }}>After you save</h3>
          <p className={styles.notice}>
            The lead starts as Talking, since you already spoke. Run the conflict check on the case file, then match them with an attorney.
            {firm.responseTime.startsWith("[") ? "" : `Our promise on the site: ${firm.responseTime}.`}
          </p>
        </aside>
      </div>
    </>
  );
}
