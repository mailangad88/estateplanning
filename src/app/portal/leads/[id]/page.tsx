import Link from "next/link";
import { notFound } from "next/navigation";
import { ForbiddenError, writableVisibilities } from "@/server/auth/policy";
import { buildCaseView, type CommentNode } from "@/server/portal/caseView";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { ApproveEngagement, CommentForm, InviteClient, OfferActions } from "@/app/portal/actions";

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

  return (
    <>
      <p><Link href="/portal">← Back to the portal</Link></p>
      {/* 1. Header */}
      <h1>{h.urgent && "⚠ "}{h.name}</h1>
      <p className="lead">{h.matterType} · {h.location} · Score {h.score} ({h.tier}) · {label(h.stage)}{h.assignedLawyer ? ` · ${h.assignedLawyer}` : ""}</p>
      <p><strong>Next step:</strong> {h.nextStep}{h.offerExpiresAt ? ` (respond by ${when(h.offerExpiresAt)})` : ""}</p>

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
        <section>
          <h2>Engagement</h2>
          {s.engagement.length === 0 ? <p>No engagement yet.</p> : (
            <ul>
              {s.engagement.map((e) => (
                <li key={e.id}>
                  {label(e.packageId)} · {money(e.feeCents)} · <strong>{e.status}</strong>{" "}
                  {actor.role === "attorney" && <ApproveEngagement engagementId={e.id} status={e.status} />}
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
