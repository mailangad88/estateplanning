import { NextResponse } from "next/server";
import { runAutomations } from "@/server/automation";
import { crmAdapterFromEnv, CrmSync } from "@/server/crm";
import { esignProviderFromEnv } from "@/server/esign";
import { factAlerts } from "@/server/facts/verify";
import { cronAuthorized } from "@/server/http";
import { retryFailedDeliveries } from "@/server/leadDelivery";
import { notifierFromEnv } from "@/server/notify";
import { getDb } from "@/server/runtime";
import { deliverSlaAlerts } from "@/server/services/intakeQueue";
import { sendDueReminders } from "@/server/services/engagement";
import { sweepExpiredOffers } from "@/server/services/routing";

/**
 * Run every minute by the scheduler (Vercel Cron, a job queue, or n8n):
 * re-routes offers past their acceptance window, sends engagement reminders, and
 * runs the automation reconciler (nurture enrollment and CRM sync), alerts intake
 * and firm admins about leads past their response targets, retries failed website
 * CRM deliveries, and counts state facts that need an attorney (shown on /portal/facts).
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const now = new Date();
  const offers = await sweepExpiredOffers(db, now);
  const reminders = await sendDueReminders(db, esignProviderFromEnv(), now);
  const automations = await runAutomations(db, new CrmSync(crmAdapterFromEnv()), now);
  const slaAlerts = await deliverSlaAlerts(db, notifierFromEnv(), now);
  const crmRetries = await retryFailedDeliveries(db, { now });
  const facts = await factAlerts(db, now);
  return NextResponse.json({
    offers, reminders, automations, slaAlerts, crmRetries,
    factAlerts: { expired: facts.filter((a) => a.severity === "expired").length, warning: facts.filter((a) => a.severity === "warning").length },
  });
}
