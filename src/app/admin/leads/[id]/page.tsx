import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, MessageSquare, Phone } from "lucide-react";
import { readableVisibilities } from "@/server/auth/policy";
import { OUTCOME_LABELS, REASON_LABELS, referralsForLead } from "@/server/services/referrals";
import {
  ANSWER_LABELS, answerValue, CONTACT_RESULTS, DESK_STATUS_LABELS, EXIT_LABELS, MANUAL_EXITS, STATUS_MOVES, toolLabel,
} from "@/server/services/leadDesk";
import { MATTER_LABELS } from "@/server/services/leads";
import { loadDesk, phoneDisplay, when } from "../data";
import { StatusPill } from "../widgets";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  landingPage: "First page", referrer: "Came from", utmSource: "Source", utmMedium: "Medium", utmCampaign: "Campaign", utmTerm: "Search term",
  utmContent: "Ad content", heardFrom: "Heard about us", partnerRef: "Partner code", gclid: "Google ad click", fbclid: "Facebook ad click",
};

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { actor, db, rows, now } = desk;
  const row = rows.find((r) => r.id === id);
  if (!row) notFound();
  const lead = await db.leads.get(id);
  if (!lead) notFound();
  const [activities, consults, comments, referrals, users] = await Promise.all([
    db.activities.list(undefined, { leadId: id }),
    db.consults.list(undefined, { leadId: id }),
    db.comments.list((c) => readableVisibilities(actor).includes(c.visibility), { leadId: id }),
    referralsForLead(db, actor, id).catch(() => []),
    db.users.list(),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const answers = Object.entries(lead.intake.answers ?? {}).filter(([, v]) => v !== undefined);
  const result = Object.entries(lead.capture?.result ?? {});
  const source = Object.entries(lead.source).filter(([k, v]) => v && !["fbc", "fbp", "gbraid", "wbraid"].includes(k));
  const timeline = [
    ...lead.stageHistory.map((h) => ({ at: h.at, text: `Status: ${h.stage.replaceAll("_", " ")}`, by: h.by === "system" ? "automatic" : userName.get(h.by) })),
    ...activities.filter((a) => a.kind !== "system" || !a.summary.startsWith("sla-")).map((a) => ({ at: a.at, text: a.summary, by: a.byUserId ? userName.get(a.byUserId) : a.kind === "system" ? "automatic" : undefined })),
    ...(lead.exit ? [{ at: lead.exit.at, text: `Closed: ${EXIT_LABELS[lead.exit.reason]}${lead.exit.note ? ` (${lead.exit.note})` : ""}`, by: undefined }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const c = lead.consent;
  const post = (path: string) => `/api/admin/leads/${id}/${path}`;

  return (
    <>
      <p><Link href="/admin/leads/all" className={styles.muted}>← All leads</Link></p>
      {sp.ok && <p className={styles.ok} role="status">{sp.ok}</p>}
      {sp.error && <p className={styles.alert} role="alert">{sp.error}</p>}

      <div className={styles.detailHead}>
        <div>
          <p className={styles.kicker}>{row.urgent || row.afterDeath ? "Urgent lead" : "Lead"} · received {when(row.createdAt)}</p>
          <h1>{row.name}</h1>
          <p className={styles.sub}>
            <StatusPill status={row.status} /> &nbsp;{MATTER_LABELS[lead.matterType]} · {row.county ? `${row.county} County, ` : ""}{row.state} · {row.tier === "hot" ? "Hot" : row.tier === "warm" ? "Warm" : "Outside our area"}{row.grade ? ` (grade ${row.grade})` : ""}
          </p>
          {row.waitingMinutes !== null && <p className={styles.alert} style={{ marginTop: 10 }}>Still waiting on a reply. Came in {row.waitingMinutes < 120 ? `${row.waitingMinutes} minutes` : `${Math.round(row.waitingMinutes / 60)} hours`} ago.{row.afterDeath ? " They lost someone: call within the hour and listen first." : ""}</p>}
        </div>
        <div className={styles.contactRow}>
          {row.phone && <a className={styles.btn} href={`tel:+1${row.phone}`}><Phone size={16} aria-hidden="true" /> {phoneDisplay(row.phone)}</a>}
          {row.phone && row.smsConsent && <a className={`${styles.btn} ${styles.btnGhost}`} href={`sms:+1${row.phone}`}><MessageSquare size={16} aria-hidden="true" /> Text</a>}
          {row.email && <a className={`${styles.btn} ${styles.btnGhost}`} href={`mailto:${row.email}`}><Mail size={16} aria-hidden="true" /> {row.email}</a>}
          <Link className={`${styles.btn} ${styles.btnGhost}`} href={`/portal/leads/${id}`}><ExternalLink size={16} aria-hidden="true" /> Full case file</Link>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <section className={styles.card}>
            <h2>What they told us</h2>
            {lead.intake.goals && <p style={{ margin: "10px 0 0" }}>&ldquo;{lead.intake.goals}&rdquo;</p>}
            {answers.length === 0 && !lead.intake.goals ? <p className={styles.empty}>No form answers. They filled in contact details only.</p> : (
              <dl className={styles.kv}>
                {answers.map(([k, v]) => <Fragment key={`${k}`}><dt>{ANSWER_LABELS[k] ?? k}</dt><dd>{answerValue(v)}</dd></Fragment>)}
                {lead.intake.redFlags.length > 0 && <><dt>Flags</dt><dd className={styles.urgent}>{lead.intake.redFlags.join("; ")}</dd></>}
              </dl>
            )}
            {lead.intake.summary && <><h3 style={{ fontSize: "0.95rem", margin: "16px 0 4px" }}>Intake summary</h3><p style={{ whiteSpace: "pre-line", margin: 0 }}>{lead.intake.summary}</p></>}
          </section>

          <section className={styles.card}>
            <h2>How they found us</h2>
            <dl className={styles.kv}>
              <dt>Came in through</dt><dd>{toolLabel(lead.capture?.tool)}{lead.capture?.resource ? ` · ${lead.capture.resource}` : ""}</dd>
              {source.map(([k, v]) => <Fragment key={`${k}`}><dt>{SOURCE_LABELS[k] ?? k}</dt><dd>{k === "landingPage" ? row.sourcePage || v : v}</dd></Fragment>)}
              {(lead.priorTools?.length ?? 0) > 0 && <><dt>Used before</dt><dd>{lead.priorTools!.map(toolLabel).join(", ")}</dd></>}
              {result.map(([k, v]) => <Fragment key={`r${k}`}><dt>{k.replaceAll("_", " ")}</dt><dd>{String(v)}</dd></Fragment>)}
            </dl>
          </section>

          <section className={styles.card} id="notes">
            <h2>Notes <span className={styles.count}>{comments.length}</span></h2>
            <p className={styles.sub}>Internal to the office unless you pick otherwise on the case file.</p>
            {comments.length > 0 && (
              <ul className={styles.timeline}>
                {comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((cm) => (
                  <li key={cm.id}><time>{when(cm.createdAt)} · {cm.authorName}</time>{cm.body}</li>
                ))}
              </ul>
            )}
            <form className={styles.form} method="post" action={post("note")}>
              <label>Add a note<textarea name="body" required maxLength={4000} placeholder="What you learned on the call, what they're worried about, when to try again" /></label>
              <div><button className={styles.btn} type="submit">Save note</button></div>
            </form>
          </section>

          <section className={styles.card}>
            <h2>Timeline</h2>
            <ul className={styles.timeline}>
              {timeline.map((t, i) => <li key={i}><time>{when(t.at)}{t.by ? ` · ${t.by}` : ""}</time>{t.text}</li>)}
            </ul>
          </section>
        </div>

        <div className={styles.stack}>
          <section className={styles.card} id="status">
            <h2>Status: {DESK_STATUS_LABELS[row.status]}</h2>
            <p className={styles.sub}>Stage: {lead.stage.replaceAll("_", " ")}{lead.conflictCard.clearance !== "pending" ? ` · conflict check ${lead.conflictCard.clearance}` : ""}</p>
            {lead.exit ? (
              <>
                <p className={styles.sub}>Closed {when(lead.exit.at)}: {EXIT_LABELS[lead.exit.reason]}{lead.exit.note ? `. ${lead.exit.note}` : ""}</p>
                {MANUAL_EXITS.includes(lead.exit.reason) && (
                  <form className={styles.form} method="post" action={post("status")}>
                    <input type="hidden" name="action" value="reopen" />
                    <div><button className={`${styles.btn} ${styles.btnGhost}`} type="submit">Reopen lead</button></div>
                  </form>
                )}
              </>
            ) : (
              <>
                <form className={styles.form} method="post" action={post("status")}>
                  <input type="hidden" name="action" value="move" />
                  <label>
                    Move to
                    <select name="stage" defaultValue="">
                      <option value="" disabled>Pick a status</option>
                      {STATUS_MOVES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </label>
                  <div><button className={styles.btn} type="submit">Update status</button></div>
                </form>
                <details style={{ marginTop: 12 }}>
                  <summary className={styles.muted}>Close this lead</summary>
                  <form className={styles.form} method="post" action={post("status")}>
                    <input type="hidden" name="action" value="close" />
                    <label>
                      Why
                      <select name="reason" required defaultValue="">
                        <option value="" disabled>Pick a reason</option>
                        {MANUAL_EXITS.map((r) => <option key={r} value={r}>{EXIT_LABELS[r]}</option>)}
                      </select>
                    </label>
                    <label>Note (optional)<input name="note" maxLength={500} /></label>
                    <div><button className={`${styles.btn} ${styles.btnGhost}`} type="submit">Close lead</button></div>
                  </form>
                </details>
              </>
            )}
          </section>

          {!lead.exit && (
            <section className={styles.card}>
              <h2>Log a call, text or email</h2>
              <p className={styles.sub}>{row.attempts} logged so far. Reaching them stops the reply clock and moves a new lead to Talking.</p>
              <form className={styles.form} method="post" action={post("contact")}>
                <div className={styles.formRow}>
                  <label>
                    How
                    <select name="kind" defaultValue="call"><option value="call">Call</option><option value="sms">Text</option><option value="email">Email</option></select>
                  </label>
                  <label>
                    What happened
                    <select name="result" defaultValue="reached">{Object.entries(CONTACT_RESULTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </label>
                </div>
                <label>Note (optional)<input name="note" maxLength={1000} placeholder="Wants a call after 5pm" /></label>
                <div><button className={styles.btn} type="submit">Log it</button></div>
              </form>
            </section>
          )}

          <section className={styles.card} id="booking">
            <h2>Booking</h2>
            {consults.length === 0 ? <p className={styles.empty}>No consult booked yet. Bookings made on the site&apos;s calendar show up here on their own.</p> : (
              <ul className={styles.timeline}>
                {consults.sort((a, b) => b.at.localeCompare(a.at)).map((k) => (
                  <li key={k.id}><time>{when(k.at)}</time>{k.type} consult · <strong>{k.status.replace("_", " ")}</strong>{k.outcome ? ` · ${k.outcome.replaceAll("_", " ")}` : ""}</li>
                ))}
              </ul>
            )}
            {row.pastConsultUnrecorded && <p className={styles.notice}>The consult time has passed. Record whether it was held on the <Link href={`/portal/leads/${id}`}>case file</Link>, or move the status to Consult held.</p>}
          </section>

          <section className={styles.card} id="match">
            <h2>Attorney match</h2>
            {row.hasAttorney ? <p className={styles.sub}>An attorney in the network has accepted this lead.</p>
              : row.openOffer ? <p className={styles.sub}>Offered to an attorney in the network, waiting for them to accept.</p>
              : lead.conflictCard.clearance === "clear" ? (
                <form className={styles.form} method="post" action={post("match")}>
                  <p className={styles.sub} style={{ margin: 0 }}>Conflict check is clear. Matching offers it to the primary attorney first, then the next fit.</p>
                  <div><button className={styles.btn} type="submit">Match with an attorney</button></div>
                </form>
              ) : <p className={styles.sub}>Run the conflict check on the <Link href={`/portal/leads/${id}`}>case file</Link> first (conflict check: {lead.conflictCard.clearance}).</p>}
          </section>

          <section className={styles.card} id="referrals">
            <div className={styles.cardHead}><h2>Referral log</h2><Link href={`/portal/leads/${id}#referrals`}>Refer or update →</Link></div>
            {referrals.length === 0 ? <p className={styles.empty}>Not referred to anyone.</p> : (
              <ul className={styles.timeline}>
                {referrals.map((r) => (
                  <li key={r.id}>
                    <time>{when(r.referredAt)}</time>
                    To {r.toName}{r.toLawyerId ? "" : " (outside the network)"} · {REASON_LABELS[r.reason]} · <strong>{OUTCOME_LABELS[r.effective]}</strong>
                    {r.note && <div className={styles.muted}>{r.note}</div>}
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.notice}>Who passed each lead to whom, why, and what happened. No fees are tracked here.</p>
          </section>

          <section className={styles.card}>
            <h2>Consent record</h2>
            <dl className={styles.kv}>
              <dt>Texts and calls</dt><dd>{c.smsConsent ? "Agreed" : "Not agreed: call or email only"}</dd>
              <dt>No-relationship notice</dt><dd>{c.acknowledgedNoRelationship ? "Acknowledged" : lead.capture?.tool === "phone_call" ? "Phone lead: read it to them on the call" : "Not acknowledged"}</dd>
              {c.marketingConsent !== undefined && <><dt>Ad measurement</dt><dd>{c.marketingConsent ? "Agreed" : "Declined"}</dd></>}
              <dt>Agreed on</dt><dd>{c.pageUrl ? (c.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/") : "unknown page"}</dd>
              <dt>Wording version</dt><dd>{c.version}</dd>
              <dt>Recorded</dt><dd>{when(c.capturedAt)}</dd>
            </dl>
            {c.smsConsentText && <details style={{ marginTop: 8 }}><summary className={styles.muted}>Exact wording they agreed to</summary><p className={styles.notice}>{c.smsConsentText}</p></details>}
          </section>
        </div>
      </div>
    </>
  );
}
