import Link from "next/link";
import { can } from "@/server/auth/policy";
import { listTemplateRows, stepsWithoutCopy, type TemplateStatus } from "@/server/nurture/templates";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { TemplateApprove } from "./TemplateApprove";

export const dynamic = "force-dynamic";
export const metadata = { title: "Message templates", robots: { index: false, follow: false } };

const SECTIONS: { status: TemplateStatus; title: string; blurb: string }[] = [
  { status: "changed", title: "Changed since approval", blurb: "The copy was edited after you approved it. It will not be sent until you approve the new text." },
  { status: "pending", title: "Pending", blurb: "Never approved. Read the preview, then approve. Nothing is sent from an unapproved template." },
  { status: "approved", title: "Approved", blurb: "Approved and current. The sender may use these." },
];

export default async function TemplateQueue() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "approve_templates")) return <p>Only attorneys and platform admins can approve message templates.</p>;
  const db = scopedDb(await getDb(), actor);
  const rows = await listTemplateRows(db, actor);
  const missing = stepsWithoutCopy().filter((s) => s.channel !== "call_task");

  return (
    <>
      <h1>Message templates</h1>
      <p className="lead">Approve the exact wording of each email and text before the nurture sequences can send it.</p>
      <p className="notice">
        An approval covers the exact text shown. Any edit to the subject or body needs a new approval. Previews use sample names and links. Every approval is recorded with your name and the date.
      </p>
      {SECTIONS.map(({ status, title, blurb }) => {
        const list = rows.filter((r) => r.status === status);
        return (
          <section key={status} style={{ marginBottom: 24 }}>
            <h2>{title} ({list.length})</h2>
            <p className="notice">{blurb}</p>
            {list.map((r) => (
              <article key={r.copy.key} className="card" style={{ marginBottom: 12 }}>
                <h3 style={{ marginTop: 0 }}>
                  {r.copy.key} <span className="notice">{r.copy.channel === "sms" ? "Text message" : "Email"}</span>
                </h3>
                {r.preview.subject !== undefined && <p><strong>Subject:</strong> {r.preview.subject}</p>}
                <pre style={{ whiteSpace: "pre-wrap", font: "inherit" }}>{r.preview.text}</pre>
                <p className="notice">
                  Source: {r.copy.source}
                  {r.approval ? ` · approved ${r.approval.approvedAt.slice(0, 10)} by ${r.approval.approvedBy} (${r.approval.id})` : ""}
                  {!r.approval && r.latest ? ` · last approved copy was ${r.latest.id}` : ""}
                </p>
                {r.approval?.note && <p className="notice">Note: {r.approval.note}</p>}
                {status !== "approved" && <TemplateApprove templateKey={r.copy.key} contentHash={r.hash} changed={status === "changed"} />}
              </article>
            ))}
          </section>
        );
      })}
      <section>
        <h2>Steps with no copy yet ({missing.length})</h2>
        <p className="notice">These sequence steps have no template, so the sender skips them. Copy has to be written from the attorney&apos;s brain file entries first.</p>
        <details>
          <summary>Show {missing.length} steps</summary>
          <ul>{missing.map((m) => <li key={m.templateKey}>{m.templateKey} · {m.sequenceId} · {m.channel}</li>)}</ul>
        </details>
      </section>
    </>
  );
}
