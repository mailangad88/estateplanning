import Link from "next/link";
import { firm } from "@/config/firm";
import { ForbiddenError } from "@/server/auth/policy";
import { clientLeadId, clientStatus } from "@/server/services/clientPortal";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { MessageForm, UploadForm } from "@/app/client/ClientActions";
import { firstNameOf } from "@/lib/people";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your case", robots: { index: false, follow: false } };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });

export default async function ClientHome() {
  const actor = await currentActor();
  if (!actor || actor.role !== "client") return <div className="container"><p>Please use the link from your attorney's office to sign in, or call us at {firm.phone}.</p></div>;
  const service = await getDb();
  const db = scopedDb(service, actor);
  const leadId = await clientLeadId(db, actor);
  if (!leadId) {
    // A second client on a joint agreement has no case page of their own: just the agreement they sign
    if (!actor.mfa) return <div className="container"><p>Two-step sign-in is needed. <Link href="/portal/login/verify">Continue</Link></p></div>;
    const joint = actor.personId
      ? (await service.engagements.list((e) => e.spousePersonId === actor.personId && e.provider === "builtin" && !["draft", "approved", "voided"].includes(e.status)))
      : [];
    if (joint.length === 0) return <div className="container"><p>We could not find your case. Call us at {firm.phone}.</p></div>;
    const toSign = joint.find((e) => e.status === "sent" || e.status === "viewed");
    return (
      <div className="container">
        <h1>Your engagement agreement</h1>
        {joint.map((e) => (
          <div className="callout" key={e.id}>
            {e === toSign
              ? <><p><strong>Your engagement agreement is ready to sign.</strong> It has a plain-language summary at the top and takes about five minutes.</p><Link className="button" href={`/client/sign/${e.id}`}>Review and sign</Link></>
              : <p>Your engagement agreement is signed. <Link href={`/client/sign/${e.id}`}>See it and download your copy</Link>.</p>}
          </div>
        ))}
        <p>Questions? Call us at {firm.phone}.</p>
      </div>
    );
  }
  let s;
  try {
    s = await clientStatus(db, actor, leadId);
  } catch (err) {
    if (err instanceof ForbiddenError) return <div className="container"><p>Two-step sign-in is needed. <Link href="/portal/login/verify">Continue</Link></p></div>;
    throw err;
  }
  const agreements = (await db.engagements.list(undefined, { leadId })).filter((e) => e.provider === "builtin" && ["sent", "viewed", "signed", "paid", "countersigned"].includes(e.status));
  const toSign = agreements.find((e) => e.status === "sent" || e.status === "viewed");
  const signed = agreements.find((e) => ["signed", "paid", "countersigned"].includes(e.status));
  // Joint agreement where this client already signed: "Waiting for Riley"
  const mineSigned = toSign?.spouseName && (await db.signatures.list(undefined, { engagementId: toSign.id })).some((x) => x.signerRole === "client");
  const waitingFor = mineSigned && toSign?.spouseName ? firstNameOf(toSign.spouseName) : undefined;
  return (
    <div className="container">
      <h1>Your case</h1>
      {s.attorney && <p className="lead">Your attorney: {s.attorney}</p>}
      {toSign && waitingFor && (
        <p className="callout">You signed your engagement agreement. <strong>Waiting for {waitingFor}</strong>, who signs from their own link. <Link href={`/client/sign/${toSign.id}`}>See the agreement</Link>.</p>
      )}
      {toSign && !waitingFor && (
        <div className="callout">
          <p><strong>Your engagement agreement is ready to sign.</strong> It has a plain-language summary at the top and takes about five minutes.</p>
          <Link className="button" href={`/client/sign/${toSign.id}`}>Review and sign</Link>
        </div>
      )}
      {!toSign && signed && (
        <p className="callout">Your engagement agreement is signed. <Link href={`/client/sign/${signed.id}`}>See it and download your copy</Link>.</p>
      )}
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
