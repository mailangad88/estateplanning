import Link from "next/link";
import { can } from "@/server/auth/policy";
import { currentActor, getDb } from "@/server/runtime";
import { SEMINAR_CAC_BAND_CENTS, seminarReadouts } from "@/server/services/seminars";
import { SeminarForm } from "./SeminarForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seminars", robots: { index: false, follow: false } };

const usd = (c: number | null) => (c === null ? "n/a" : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);
const FORMAT = { in_person: "In person", webinar: "Webinar", library_talk: "Community talk" } as const;

export default async function SeminarsPage() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "manage_seminars")) return <p>Seminar tracking is for marketing and platform admins.</p>;
  // Totals only: the readout counts attributed leads without exposing any of them, so it
  // reads through the service store after the permission check above.
  const readouts = await seminarReadouts(await getDb(), actor);

  return (
    <>
      <p><Link href="/portal">← Back to the portal</Link></p>
      <h1>Seminars and webinars</h1>
      <p className="notice">
        Leads count toward an event when their utm_campaign matches its code. The research range for cost per signed client is {usd(SEMINAR_CAC_BAND_CENTS.low)} to {usd(SEMINAR_CAC_BAND_CENTS.high)}.
        Invitations are attorney advertising: label them and keep copies.
      </p>
      {readouts.length === 0 ? <p>No events yet.</p> : readouts.map((r) => (
        <section key={r.seminar.id} className="card">
          <h2>{r.seminar.title}</h2>
          <p className="notice">{FORMAT[r.seminar.format]} · {r.seminar.heldOn}{r.seminar.venue ? ` · ${r.seminar.venue}` : ""} · code <code>{r.seminar.code}</code></p>
          <table>
            <tbody>
              <tr><td>Cost</td><td>{usd(r.totalCostCents)}</td><td>RSVPs</td><td>{r.seminar.rsvps}</td><td>Attended</td><td>{r.seminar.attendees} ({pct(r.showRate)})</td></tr>
              <tr><td>Leads</td><td>{r.leads}</td><td>Consults booked</td><td>{r.consultsBooked}</td><td>Held</td><td>{r.consultsHeld}</td></tr>
              <tr><td>Signed</td><td>{r.signed}</td><td>Fees</td><td>{usd(r.feesCents)}</td><td>Return on cost</td><td>{r.returnOnCost === null ? "n/a" : `${Math.round(r.returnOnCost * 10) / 10}x`}</td></tr>
              <tr><td>Per RSVP</td><td>{usd(r.costPerRsvpCents)}</td><td>Per attendee</td><td>{usd(r.costPerAttendeeCents)}</td><td>Per signed client</td><td><strong>{usd(r.cacCents)}</strong></td></tr>
            </tbody>
          </table>
          <p>{r.verdict}</p>
          <details>
            <summary>Update counts and costs</summary>
            <SeminarForm initial={{ ...r.seminar }} />
          </details>
        </section>
      ))}
      <h2>Add an event</h2>
      <SeminarForm />
    </>
  );
}
