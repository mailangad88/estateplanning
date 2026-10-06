import Link from "next/link";
import { firm } from "@/config/firm";
import { ForbiddenError } from "@/server/auth/policy";
import { clientLeadId, clientStatus } from "@/server/services/clientPortal";
import { currentActor, getDb } from "@/server/runtime";
import { MessageForm, UploadForm } from "@/app/client/ClientActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your case", robots: { index: false, follow: false } };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });

export default async function ClientHome() {
  const actor = await currentActor();
  if (!actor || actor.role !== "client") return <div className="container"><p>Please use the link from your attorney's office to sign in, or call us at {firm.phone}.</p></div>;
  const db = await getDb();
  const leadId = await clientLeadId(db, actor);
  if (!leadId) return <div className="container"><p>We could not find your case. Call us at {firm.phone}.</p></div>;
  let s;
  try {
    s = await clientStatus(db, actor, leadId);
  } catch (err) {
    if (err instanceof ForbiddenError) return <div className="container"><p>Two-step sign-in is needed. <Link href="/portal/login/verify">Continue</Link></p></div>;
    throw err;
  }
  return (
    <div className="container">
      <h1>Your case</h1>
      {s.attorney && <p className="lead">Your attorney: {s.attorney}</p>}
      <p><strong>What happens next:</strong> {s.nextStep}</p>

      <h2>Where things stand</h2>
      <ol className="steps">
        {s.steps.map((st) => (
          <li key={st.label}>{st.done ? "Done: " : "Coming up: "}{st.current ? <strong>{st.label}</strong> : st.label}</li>
        ))}
      </ol>

      <h2>What to gather</h2>
      <ul className="checklist">
        {s.checklist.map((c) => (
          <li key={c.key}>{c.uploaded > 0 ? "Received: " : "Still needed: "}<strong>{c.label}</strong>. {c.hint}</li>
        ))}
      </ul>
      <p className="notice">Not sure what something is? Skip it and tell us in a message.</p>

      <h2>Upload a document</h2>
      <UploadForm options={s.checklist.map((c) => ({ value: c.kinds[0], label: c.label }))} />
      {s.documents.length > 0 && (
        <ul>{s.documents.map((d) => <li key={d.id}>{d.name} ({when(d.uploadedAt)})</li>)}</ul>
      )}

      <h2>Messages</h2>
      {s.comments.length === 0 ? <p>No messages yet.</p> : (
        <ul>{s.comments.map((c) => <li key={c.id}><strong>{c.authorName}</strong> <span className="notice">{when(c.createdAt)}</span><p>{c.body}</p></li>)}</ul>
      )}
      <MessageForm />

      <p className="notice">Prefer to talk? Call {firm.phone}. Messages here are not for emergencies and are not legal advice.</p>
    </div>
  );
}
