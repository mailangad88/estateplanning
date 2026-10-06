/**
 * Attorney capacity planner. Compares consult slots with incoming leads so the
 * firm stops buying leads it cannot serve: one attorney saturates near 190 consult
 * leads a month (research/lead-volume-model.md section 5), and past that every
 * extra paid lead is wasted spend and a slower answer for the client.
 *
 * Read-only: it recommends a spend posture ("scale", "hold", "throttle") and the
 * ad scripts or a person act on it. Nothing here changes ad budgets.
 */
import type { Db } from "@/server/db";

const DAY = 86_400_000;
const WEEKS_AHEAD = 8;

/** Funnel ratios behind the monthly ceiling. Editable; defaults are the research base case. */
export const CAPACITY_ASSUMPTIONS = {
  /** Share of booked consults that are held */
  showRate: 0.7,
  /** Share of consult leads that book a consult */
  bookRate: 0.3,
  weeksPerMonth: 4.33,
  /** Waitlist at which a lawyer counts as filling up */
  fillingDays: 7,
  /** Waitlist at which a lawyer counts as booked out */
  bookedOutDays: 14,
};

export type CapacityStatus = "open" | "filling" | "booked_out";
export type SpendAdvice = "scale" | "hold" | "throttle";

export interface LawyerCapacity {
  lawyerId: string;
  name: string;
  weeklyCapacity: number;
  bookedNext7: number;
  bookedNext14: number;
  heldLast7: number;
  /** Days until the first week with an open consult slot */
  waitlistDays: number;
  /** Accepted leads still waiting for a consult to be booked */
  awaitingBooking: number;
  /** Leads this lawyer accepted in the last 30 days */
  acceptedLast30: number;
  /** Consult leads a month this lawyer can absorb at the assumed show and book rates */
  monthlyLeadCeiling: number;
  status: CapacityStatus;
}

export interface CapacityReport {
  generatedAt: string;
  lawyers: LawyerCapacity[];
  firm: {
    weeklyCapacity: number;
    incomingLast30: number;
    monthlyLeadCeiling: number;
    /** incomingLast30 / monthlyLeadCeiling, or null when there is no capacity at all */
    utilization: number | null;
    /** Shortest waitlist across active lawyers: how soon a new client can be seen */
    soonestSlotDays: number | null;
    status: CapacityStatus;
  };
  spendAdvice: SpendAdvice;
  reason: string;
}

export function monthlyLeadCeiling(weeklyCapacity: number, a = CAPACITY_ASSUMPTIONS): number {
  return Math.round((weeklyCapacity * a.weeksPerMonth) / a.showRate / a.bookRate);
}

function statusFor(waitlistDays: number, a = CAPACITY_ASSUMPTIONS): CapacityStatus {
  if (waitlistDays >= a.bookedOutDays) return "booked_out";
  if (waitlistDays >= a.fillingDays) return "filling";
  return "open";
}

/** Firm-wide, or one firm's lawyers and leads when firmId is given (firm admins). */
export async function capacityReport(db: Db, now = new Date(), firmId?: string): Promise<CapacityReport> {
  const a = CAPACITY_ASSUMPTIONS;
  const t = now.getTime();
  const lawyers = (await db.lawyers.list()).filter((l) => l.active && (!firmId || l.firmId === firmId));
  const consults = await db.consults.list();
  const leads = await db.leads.list();
  const assignments = await db.assignments.list((x) => x.status === "accepted");

  const rows: LawyerCapacity[] = lawyers.map((lw) => {
    const mine = consults.filter((c) => c.lawyerId === lw.id);
    const bookedIn = (fromDays: number, toDays: number) =>
      mine.filter((c) => c.status === "booked" && new Date(c.at).getTime() >= t + fromDays * DAY && new Date(c.at).getTime() < t + toDays * DAY).length;
    let waitlistDays = WEEKS_AHEAD * 7;
    if (lw.weeklyCapacity > 0) {
      for (let w = 0; w < WEEKS_AHEAD; w++) {
        if (bookedIn(w * 7, (w + 1) * 7) < lw.weeklyCapacity) {
          waitlistDays = w * 7;
          break;
        }
      }
    }
    const awaitingBooking = leads.filter((l) => l.assignedLawyerId === lw.id && !l.exit && l.stage === "accepted").length;
    return {
      lawyerId: lw.id,
      name: lw.name,
      weeklyCapacity: lw.weeklyCapacity,
      bookedNext7: bookedIn(0, 7),
      bookedNext14: bookedIn(0, 14),
      heldLast7: mine.filter((c) => c.status === "held" && new Date(c.at).getTime() >= t - 7 * DAY && new Date(c.at).getTime() <= t).length,
      waitlistDays,
      awaitingBooking,
      acceptedLast30: assignments.filter((x) => x.lawyerId === lw.id && x.respondedAt && new Date(x.respondedAt).getTime() >= t - 30 * DAY).length,
      monthlyLeadCeiling: monthlyLeadCeiling(lw.weeklyCapacity, a),
      status: statusFor(waitlistDays, a),
    };
  });

  const weeklyCapacity = rows.reduce((s, r) => s + r.weeklyCapacity, 0);
  const ceiling = monthlyLeadCeiling(weeklyCapacity, a);
  // Firm-wide counts every qualified-looking lead; one firm counts the leads routed to it.
  const incomingLast30 = leads.filter(
    (l) => new Date(l.createdAt).getTime() >= t - 30 * DAY && l.exit?.reason !== "not_a_fit" && (!firmId || l.firmId === firmId),
  ).length;
  const utilization = ceiling > 0 ? incomingLast30 / ceiling : null;
  const soonestSlotDays = rows.length ? Math.min(...rows.map((r) => r.waitlistDays)) : null;
  const firmStatus: CapacityStatus = soonestSlotDays === null ? "booked_out" : statusFor(soonestSlotDays, a);

  let spendAdvice: SpendAdvice;
  let reason: string;
  if (firmStatus === "booked_out" || (utilization !== null && utilization >= 1)) {
    spendAdvice = "throttle";
    reason =
      soonestSlotDays === null
        ? "No active attorney has consult capacity."
        : firmStatus === "booked_out"
          ? `Every attorney is booked out at least ${soonestSlotDays} days. Pause or cut paid campaigns until slots open.`
          : `Incoming leads (${incomingLast30} in 30 days) are at or over what the calendar can absorb (${ceiling}).`;
  } else if (firmStatus === "filling" || (utilization !== null && utilization >= 0.8)) {
    spendAdvice = "hold";
    reason = `The calendar is filling (soonest slot in ${soonestSlotDays} days, ${incomingLast30} of ${ceiling} monthly leads). Hold spend steady.`;
  } else {
    spendAdvice = "scale";
    reason = `Slots are open this week and incoming leads are ${incomingLast30} of ${ceiling} the calendar can absorb.`;
  }

  return {
    generatedAt: now.toISOString(),
    lawyers: rows,
    firm: { weeklyCapacity, incomingLast30, monthlyLeadCeiling: ceiling, utilization, soonestSlotDays, status: firmStatus },
    spendAdvice,
    reason,
  };
}
