import Link from "next/link";
import { can } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { CAPACITY_ASSUMPTIONS, capacityReport, type CapacityStatus, type SpendAdvice } from "@/server/services/capacity";

export const dynamic = "force-dynamic";
export const metadata = { title: "Capacity", robots: { index: false, follow: false } };

const STATUS: Record<CapacityStatus, string> = { open: "Open", filling: "Filling up", booked_out: "Booked out" };
const ADVICE: Record<SpendAdvice, string> = { scale: "Room to grow paid spend", hold: "Hold paid spend steady", throttle: "Cut or pause paid spend" };

export default async function CapacityPage() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "manage_firm_capacity")) return <p>Capacity planning is for platform and firm admins.</p>;
  const db = scopedDb(await getDb(), actor);
  const r = await capacityReport(db, new Date(), actor.role === "firm_admin" ? actor.firmId : undefined);
  const a = CAPACITY_ASSUMPTIONS;

  return (
    <>
      <p><Link href="/portal">← Back to the portal</Link></p>
      <h1>Attorney capacity</h1>
      <section className="card">
        <h2>{ADVICE[r.spendAdvice]}</h2>
        <p>{r.reason}</p>
        <p className="notice">
          {STATUS[r.firm.status]} · {r.firm.weeklyCapacity} consult slots a week · {r.firm.incomingLast30} leads in 30 days against a ceiling of {r.firm.monthlyLeadCeiling}
          {r.firm.utilization !== null ? ` (${Math.round(r.firm.utilization * 100)}%)` : ""}
        </p>
      </section>
      <h2>By attorney</h2>
      {r.lawyers.length === 0 ? <p>No active attorneys.</p> : (
        <table>
          <thead><tr><th>Attorney</th><th>Slots a week</th><th>Booked next 7 days</th><th>Next 14 days</th><th>Held last 7 days</th><th>Soonest slot</th><th>Waiting to book</th><th>Accepted in 30 days</th><th>Monthly lead ceiling</th><th>Status</th></tr></thead>
          <tbody>
            {r.lawyers.map((l) => (
              <tr key={l.lawyerId}>
                <td>{l.name}</td><td>{l.weeklyCapacity}</td><td>{l.bookedNext7}</td><td>{l.bookedNext14}</td><td>{l.heldLast7}</td>
                <td>{l.waitlistDays === 0 ? "this week" : `${l.waitlistDays} days`}</td><td>{l.awaitingBooking}</td><td>{l.acceptedLast30}</td><td>{l.monthlyLeadCeiling}</td><td>{STATUS[l.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="notice">
        The ceiling assumes {Math.round(a.showRate * 100)}% of booked consults are held and {Math.round(a.bookRate * 100)}% of consult leads book. Filling up means the soonest slot is {a.fillingDays}+ days out; booked out means {a.bookedOutDays}+ days. Ad scripts can read the same advice from <code>/api/capacity/status</code>.
      </p>
    </>
  );
}
