import { NextResponse } from "next/server";
import { runAutomations } from "@/server/automation";
import { sweepConversions } from "@/server/conversions/sweep";
import { crmAdapterFromEnv, CrmSync } from "@/server/crm";
import { esignProviderFromEnv } from "@/server/esign";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { factAlerts } from "@/server/facts/verify";
import { cronAuthorized } from "@/server/http";
import { retryFailedDeliveries } from "@/server/leadDelivery";
import { notifierFromEnv } from "@/server/notify";
import { emailTransportFromEnv, smsTransportFromEnv } from "@/server/notify/transports";
import { nurtureOwnerFromEnv } from "@/server/nurture/owner";
import { runNurtureSends } from "@/server/nurture/sender";
import { ApprovedTemplateSource } from "@/server/nurture/templates";
import { getDb } from "@/server/runtime";
import { deliverSlaAlerts } from "@/server/services/intakeQueue";
import { sendDueReminders } from "@/server/services/engagement";
import { flagLateInstallments, issueDueLinks } from "@/server/services/retainerPayments";
import { sweepExpiredOffers } from "@/server/services/routing";

/**
 * Run every minute by the scheduler (Vercel Cron, a job queue, or n8n). Each job
 * runs on its own, so one failing job (a misconfigured provider, say) is reported
 * in the response and never stops the others:
 * - offers: re-route offers past their acceptance window
 * - reminders: engagement letter reminders
 * - automations: triage, nurture enrollment, CRM sync, review requests
 * - nurture: send due follow-up steps (dry run unless OUTBOUND_SEND_MODE=live). With NURTURE_OWNER=crm
 *   message steps are skipped (reported as crmOwned) and call tasks still run
 * - slaAlerts: tell intake and admins about leads past their response targets
 * - crmRetries: retry failed website-to-CRM deliveries
 * - payments: flag late installments and issue links for installments now due
 * - conversions: queue and send offline ad conversions
 * - factAlerts: count state facts that need an attorney (shown on /portal/facts)
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const now = new Date();
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const job = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (err) {
      errors[name] = err instanceof Error ? err.message : String(err);
      console.error(`cron sweep: ${name} failed`, { error: errors[name] });
    }
  };

  await job("offers", () => sweepExpiredOffers(db, now));
  await job("reminders", () => sendDueReminders(db, esignProviderFromEnv(), now));
  // NURTURE_OWNER=crm: the CRM sends email and SMS; we push state and still create call tasks.
  let owner: "crm" | "internal" = "internal";
  try {
    owner = nurtureOwnerFromEnv();
  } catch (err) {
    errors.nurtureOwner = err instanceof Error ? err.message : String(err);
  }
  out.nurtureOwner = owner;
  await job("automations", () => runAutomations(db, new CrmSync(crmAdapterFromEnv()), now, { pushNurtureState: owner === "crm" }));
  await job("nurture", () =>
    runNurtureSends(db, { templates: new ApprovedTemplateSource(), email: emailTransportFromEnv(), sms: smsTransportFromEnv(), limit: 200, owner }, now),
  );
  await job("slaAlerts", () => deliverSlaAlerts(db, notifierFromEnv(), now));
  await job("crmRetries", () => retryFailedDeliveries(db, { now }));
  await job("payments", async () => ({ late: await flagLateInstallments(db, now), linksIssued: await issueDueLinks(db, paymentProviderFromEnv(), now) }));
  await job("conversions", () => sweepConversions(db, { now }));
  await job("factAlerts", async () => {
    const facts = await factAlerts(db, now);
    return { expired: facts.filter((a) => a.severity === "expired").length, warning: facts.filter((a) => a.severity === "warning").length };
  });

  return NextResponse.json({ ...out, errors }, { status: Object.keys(errors).length ? 207 : 200 });
}
