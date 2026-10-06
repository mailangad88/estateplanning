import Link from "next/link";
import { can } from "@/server/auth/policy";
import { currentActor, getDb } from "@/server/runtime";
import { intakeQueue } from "@/server/services/intakeQueue";
import { ClaimButton } from "./QueueActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intake queue", robots: { index: false, follow: false } };

const SLA_LABEL = { ok: "On track", due_soon: "Due soon", breached: "Overdue" } as const;

export default async function QueuePage() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "work_intake_queue")) return <p>The intake queue is for the intake team.</p>;
  const db = await getDb();
  const items = await intakeQueue(db, actor, new Date());
  return (
    <>
      <h1>Intake queue</h1>
      <p className="notice">Urgent first, then leads past the 5-minute call target, then oldest. Open a case for contact details.</p>
      {items.length === 0 ? <p>The queue is clear.</p> : (
        <table>
          <thead><tr><th>Lead</th><th>Matter</th><th>Waiting</th><th>SLA</th><th>Next action</th><th>Owner</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.taskId ?? i.leadId}>
                <td><Link href={`/portal/leads/${i.leadId}`}>{i.urgent ? "Urgent · " : ""}{i.leadId.slice(0, 8)}</Link></td>
                <td>{i.matter}, {i.state}</td>
                <td>{i.minutesWaiting} min</td>
                <td>{SLA_LABEL[i.slaStatus]}</td>
                <td>{i.nextAction}</td>
                <td>{i.ownerName}</td>
                <td>{i.kind === "lead" && i.ownerName === "Unclaimed" ? <ClaimButton leadId={i.leadId} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
