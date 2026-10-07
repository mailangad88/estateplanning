import Link from "next/link";
import { notFound } from "next/navigation";
import { ForbiddenError, writableVisibilities } from "@/server/auth/policy";
import { buildCaseView, type CommentNode } from "@/server/portal/caseView";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { ApproveEngagement, CommentForm, InviteClient, OfferActions, RefundPayment } from "@/app/portal/actions";
import {
  ASSET_TYPE_LABELS,
  DOC_KEYS,
  DOC_LABELS,
  MARITAL_LABELS,
  SECTION_KEYS,
  SECTION_LABELS,
  YES_NO_UNSURE_LABELS,
  formatTotal,
  type AssetType,
} from "@/lib/familyPlan";
import type { OrganizerSummaryView } from "@/server/services/familyPlan";

import { SendRetainer } from "./SendRetainer";
import { packages, retainerPayments } from "@/config/firm";
import { STAGES, type MatterType } from "@/server/types";
import { PACKAGES } from "@/server/services/engagement";

/** Starting prices on the Send retainer form, from the platform's placeholder package fees. The attorney sets the real fee. */
const TIER_DEFAULT_CENTS: Record<string, number> = {
  essentials: PACKAGES.will_package.defaultFeeCents,
  complete: PACKAGES.trust_package.defaultFeeCents,
  legacy: PACKAGES.couples_trust.defaultFeeCents,
};
const TIER_FOR_MATTER: Partial<Record<MatterType, string>> = { new_plan: "complete", update_plan: "essentials", special_needs: "legacy", business_succession: "legacy" };

export const dynamic = "force-dynamic";
export const metadata = { title: "Case", robots: { index: false, follow: false } };

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const label = (s: string) => s.replaceAll("_", " ");

function Comments({ nodes, leadId, visibilities }: { nodes: CommentNode[]; leadId: string; visibilities: string[] }) {
  return (
    <ul>
      {nodes.map((c) => (
        <li key={c.id}>
          <strong>{c.authorName}</strong> <span className="notice">{when(c.createdAt)} · {c.visibility === "internal" ? "intake only" : c.visibility}</span>
          <p>{c.body}</p>
          {c.replies.length > 0 && <Comments nodes={c.replies} leadId={leadId} visibilities={visibilities} />}
        </li>
      ))}
    </ul>
  );
}

function OrganizerSummary({ view }: { view: OrganizerSummaryView }) {
  const s = view.summary;
  const h = s.household;
  const yes = (b: boolean) => (b ? "named" : "not named");
  return (
    <section className="card">
      <h2>Organizer summary</h2>
      <p className="notice">
        From the client&apos;s &ldquo;My family plan&rdquo; organizer, updated {when(view.updatedAt)}. Self-reported counts and ranges only; the client&apos;s
        names, notes and wishes stay with them. {s.sectionsDone} of {s.sectionsTotal} sections done (
        {SECTION_KEYS.filter((k) => s.sections[k] === "done").map((k) => SECTION_LABELS[k]).join(", ") || "none yet"}).
      </p>
      <h3>Gaps the organizer flagged ({s.gaps.length})</h3>
      {s.gaps.length === 0 ? <p>None from what they entered.</p> : <ul>{s.gaps.map((g) => <li key={g.code}>{g.text}</li>)}</ul>}
      <h3>Household</h3>
      <p>
        {h.homeState ?? "State not given"} · {h.maritalStatus ? MARITAL_LABELS[h.maritalStatus] : "relationship not given"} · {h.children} children listed, {h.minors} minor
        {h.minors > 0 && <> · guardian {yes(h.guardianNamed)}, backup {yes(h.backupGuardianNamed)}</>}
        {" "}· executor {yes(h.executorNamed)} · financial agent {yes(h.financialAgentNamed)} · healthcare agent {yes(h.healthcareAgentNamed)}
      </p>
      <h3>Assets ({s.assets.count})</h3>
      {s.assets.count > 0 && (
        <>
          <p>
            Rough total {formatTotal(s.assets.totalLow, s.assets.totalHigh)}
            {s.assets.unvalued > 0 ? ` plus ${s.assets.unvalued} not estimated` : ""} · {s.assets.inTrust} in a trust · {s.assets.titledAlone} in their name alone ·{" "}
            {s.assets.titlingNotSure} titling not sure · {s.assets.beneficiaryNamed} with a beneficiary named · {s.assets.beneficiaryMissing} without
          </p>
          <ul>{(Object.entries(s.assets.byType) as [AssetType, number][]).map(([t, n]) => <li key={t}>{ASSET_TYPE_LABELS[t]}: {n}</li>)}</ul>
        </>
      )}
      <h3>Existing documents</h3>
      <table>
        <tbody>
          {DOC_KEYS.map((k) => {
            const d = s.documents[k];
            return (
              <tr key={k}>
                <td>{DOC_LABELS[k]}</td>
                <td>{d?.has ? YES_NO_UNSURE_LABELS[d.has] : "not answered"}{d?.yearSigned ? ` · ${d.yearSigned}` : ""}{d?.state ? ` · ${d.state}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="notice">Wishes written down: {s.hasWishes ? "yes" : "no"} · Where papers are kept: {s.hasPapersLocation ? "noted" : "not noted"}</p>
    </section>
  );
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  let view;
  try {
    view = await buildCaseView(scopedDb(await getDb(), actor), actor, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return <p>You do not have access to this case.</p>;
    notFound();
  }
  const { header: h, sections: s } = view;
  const canSendRetainer =
    view.access === "full" && (actor.role === "attorney" || actor.role === "paralegal") && !h.nextStep.startsWith("Closed") &&
    STAGES.indexOf(h.stage) >= STAGES.indexOf("accepted") && STAGES.indexOf(h.stage) <= STAGES.indexOf("proposal_sent");

  return (
    <>
      <p><Link href="/portal">← Back to the portal</Link></p>
      {/* 1. Header */}
      <h1>{h.urgent && "⚠ "}{h.name}</h1>
      <p className="lead">{h.matterType} · {h.location} · Score {h.score} (grade {h.grade ?? h.tier}) · {label(h.stage)}{h.assignedLawyer ? ` · ${h.assignedLawyer}` : ""}</p>
      <p><strong>Next step:</strong> {h.nextStep}{h.offerExpiresAt ? ` (respond by ${when(h.offerExpiresAt)})` : ""}</p>

      {h.scoreComponents && h.scoreComponents.length > 0 && (
        <details>
          <summary>Why this score</summary>
          <ul>{h.scoreComponents.map((c, i) => <li key={i}>{c.points > 0 ? "+" : ""}{c.points} {c.label}</li>)}</ul>
        </details>
      )}

      {view.access === "conflict_card" && h.offerAssignmentId && <OfferActions assignmentId={h.offerAssignmentId} />}
      {view.access === "full" && h.assignedLawyer && actor.role !== "marketing" && <InviteClient leadId={id} />}

      {/* 2. Summary */}
      {s.summary && (
        <section className="card">
          <h2>Summary</h2>
          {s.summary.summary ? <p style={{ whiteSpace: "pre-line" }}>{s.summary.summary}</p> : <p>{s.summary.offerSummary}</p>}
          {s.summary.goals && <p><strong>In their words:</strong> “{s.summary.goals}”</p>}
        </section>
      )}

      {/* 3. Red flags and deadlines */}
      {s.redFlags && (s.redFlags.redFlags.length > 0 || s.redFlags.deadlines.length > 0) && (
        <section>
          <h2>Red flags and deadlines</h2>
          <ul>
            {s.redFlags.redFlags.map((f) => <li key={f} className="error">{f}</li>)}
            {s.redFlags.deadlines.map((d) => <li key={d.label}>{d.label}: {d.date}</li>)}
          </ul>
        </section>
      )}

      {/* 4. Conflict check */}
      {s.conflict && (
        <section>
          <h2>Conflict check</h2>
          <p>Client: {s.conflict.clientName} · Clearance: <strong>{s.conflict.clearance}</strong></p>
          {s.conflict.parties.length === 0 ? <p>No other parties recorded.</p> : (
            <ul>{s.conflict.parties.map((p) => <li key={p.name + p.relationship}>{p.name} ({p.relationship})</li>)}</ul>
          )}
        </section>
      )}

      {/* 5. Family and household */}
      {s.household && (
        <section>
          <h2>Family and household</h2>
          <p>Relationship: {s.household.maritalStatus ?? "not given"} · Children: {s.household.children ?? "not given"}</p>
          <ul>{s.household.members.map((m) => <li key={m.name}>{m.name}, {m.relationship}{m.age !== undefined ? `, ${m.age}` : ""}</li>)}</ul>
        </section>
      )}

      {/* 6. Assets */}
      {s.assets && (
        <section>
          <h2>Assets (ranges)</h2>
          <p>
            Total: {s.assets.range ? label(s.assets.range) : "not given"} · Home: {s.assets.ownsHome ? "yes" : "no"} · Business: {s.assets.ownsBusiness ? "yes" : "no"} · Out-of-state property:{" "}
            {s.assets.outOfStateProperty ? (s.assets.outOfStateStates?.join(", ") || "yes") : "no"}
          </p>
        </section>
      )}

      {/* 6b. The client's "My family plan" organizer: counts, ranges and gaps only */}
      {s.organizer && <OrganizerSummary view={s.organizer} />}

      {/* 7. Documents */}
      {s.documents && (
        <section>
          <h2>Documents</h2>
          {s.documents.length === 0 ? <p>No documents yet.</p> : (
            <ul>{s.documents.map((d) => <li key={d.id}>{d.name} · {label(d.kind)} · {d.scanStatus === "clean" ? "ready" : "being checked"}</li>)}</ul>
          )}
        </section>
      )}

      {/* 8. Answers */}
      {s.answers && (
        <section>
          <h2>Quiz and form answers</h2>
          <table><tbody>{Object.entries(s.answers).map(([k, v]) => <tr key={k}><td>{k}</td><td>{label(String(v))}</td></tr>)}</tbody></table>
        </section>
      )}

      {/* 9. Timeline */}
      {s.timeline && (
        <section>
          <h2>Communication timeline</h2>
          {s.timeline.length === 0 ? <p>No calls, texts or emails yet.</p> : (
            <ul>{s.timeline.map((a) => <li key={a.id}>{when(a.at)} · {a.kind}{a.direction ? ` (${a.direction})` : ""}: {a.summary}</li>)}</ul>
          )}
        </section>
      )}

      {/* 10. Comments */}
      {s.comments && (
        <section>
          <h2>Comments</h2>
          <Comments nodes={s.comments} leadId={id} visibilities={writableVisibilities(actor)} />
          <CommentForm leadId={id} visibilities={writableVisibilities(actor)} />
        </section>
      )}

      {/* 11. Consult */}
      {s.consult && (
        <section>
          <h2>Consult</h2>
          {s.consult.length === 0 ? <p>Not booked yet.</p> : (
            <ul>{s.consult.map((c) => <li key={c.id}>{when(c.at)} · {c.type} · {c.status}{c.outcome ? ` · ${label(c.outcome)}` : ""}{c.notes ? `: ${c.notes}` : ""}</li>)}</ul>
          )}
        </section>
      )}

      {/* 12. Engagement */}
      {s.engagement && (
        <section id="engagement">
          <h2>Engagement</h2>
          {canSendRetainer && (
            <SendRetainer
              hasLive={s.engagement.some((e) => e.status !== "voided")}
              leadId={id}
              clientFirstName={h.name.split(" ")[0] || "the client"}
              tiers={packages.map((p) => ({ id: p.id, name: p.name, defaultCents: TIER_DEFAULT_CENTS[p.id] }))}
              defaultTierId={TIER_FOR_MATTER[h.matterKey] ?? "complete"}
              spouseName={s.household?.members.find((m) => m.relationship === "spouse" || m.relationship === "partner")?.name}
              canApprove={actor.role === "attorney"}
              planAllowed={retainerPayments.plan.enabled}
            />
          )}
          {s.engagement.length === 0 ? (!canSendRetainer && <p>No engagement yet.</p>) : (
            <ul>
              {s.engagement.map((e) => (
                <li key={e.id}>
                  {e.packageSelection ? `${e.packageSelection.tierName} package` : label(e.packageId)} · {money(e.feeCents)} · <strong>{e.status}</strong>{" "}
                  {actor.role === "attorney" && <ApproveEngagement engagementId={e.id} status={e.status} />}
                  <p className="notice">
                    {e.templateName ? `From your template ${e.templateName}` : "Platform draft letter"}
                    {e.attachment ? ` + ${e.attachment.name}` : ""}
                    {e.provider === "builtin" && e.status !== "draft" && e.status !== "approved" && <> · <a href={`/client/sign/${e.id}`}>signing page</a></>}
                  </p>
                  {e.signatures.length > 0 && (
                    <ul>
                      {e.signatures.map((sig) => (
                        <li key={sig.id}>Signed by {sig.expectedName} (typed “{sig.typedName}”) {when(sig.signedAt)} · document <code>{sig.documentSha256.slice(0, 12)}…</code></li>
                      ))}
                      {e.spouseName && e.signatures.length < 2 && <li>Waiting for {e.signatures.some((x) => x.signerRole === "spouse") ? h.name : e.spouseName} to sign</li>}
                    </ul>
                  )}
                  {e.packageSelection && e.packageSelection.addOns.length > 0 && (
                    <p>Add-ons: {e.packageSelection.addOns.map((a) => `${a.name} (${money(a.priceCents)})`).join(", ")}</p>
                  )}
                  {e.paymentPlan && (
                    <div>
                      <p>
                        <strong>Payment: {e.paymentPlan.mode === "full" ? "pay in full" : `deposit plus ${e.paymentPlan.installments.length - 1} monthly installments`}</strong>
                        {" · "}{label(e.paymentStatus.state)} · paid {money(e.paymentStatus.paidCents)} of {money(e.paymentStatus.totalCents)}
                        {e.paymentStatus.refundedCents > 0 && <> · refunded {money(e.paymentStatus.refundedCents)}</>}
                        {" · "}paid into the firm {e.paymentPlan.account === "trust" ? "client trust account" : "operating account"}
                      </p>
                      <table>
                        <thead><tr><th>#</th><th>Payment</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
                        <tbody>
                          {e.paymentPlan.installments.map((i) => (
                            <tr key={i.n}>
                              <td>{i.n}</td>
                              <td>{i.kind === "installment" ? `Installment ${i.n - 1}` : i.kind === "deposit" ? "Deposit" : "Full payment"}</td>
                              <td>{money(i.amountCents)}</td>
                              <td>{i.dueOn ?? "On signing"}</td>
                              <td><strong>{i.status}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {e.payments.length > 0 && (
                    <ul>
                      {e.payments.map((p) => (
                        <li key={p.id}>
                          {p.installmentNo ? `Payment ${p.installmentNo}` : "Payment"} · {money(p.amountCents)} · {p.status} · {p.account === "trust" ? "trust" : "operating"} account
                          {p.status === "pending" && p.linkUrl && <> · <a href={p.linkUrl}>payment link</a></>}
                          {p.refunds.length > 0 && <> · refunded {money(p.refunds.reduce((t, r) => t + r.amountCents, 0))}</>}
                          {actor.role === "attorney" && p.status === "paid" && <RefundPayment paymentId={p.id} maxCents={p.amountCents - p.refunds.reduce((t, r) => t + r.amountCents, 0)} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.clientSummary && (
                    <details>
                      <summary>Client summary</summary>
                      <p><strong>{e.clientSummary.headline}</strong></p>
                      {e.clientSummary.lines.map((l) => <p key={l}>{l}</p>)}
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 13. Tasks */}
      {s.tasks && (
        <section>
          <h2>Tasks</h2>
          {s.tasks.length === 0 ? <p>No open tasks.</p> : (
            <ul>{s.tasks.map((t) => <li key={t.id}>{t.doneAt ? "✓ " : ""}{t.title} · due {when(t.dueAt)}</li>)}</ul>
          )}
        </section>
      )}

      {/* 14. Source and attribution */}
      {s.source && (
        <details>
          <summary>Source and attribution</summary>
          <ul>{Object.entries(s.source).filter(([, v]) => v).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
        </details>
      )}

      {/* 15. Audit log */}
      {s.audit && (
        <details>
          <summary>Audit log ({s.audit.length})</summary>
          <ul>{s.audit.map((e) => <li key={e.id}>{when(e.at)} · {e.actorRole} {e.actorId} · {e.action}</li>)}</ul>
        </details>
      )}
    </>
  );
}
