import { NextResponse } from "next/server";
import { runAutomations } from "@/server/automation";
import { crmAdapterFromEnv, CrmSync } from "@/server/crm";
import { esignProviderFromEnv } from "@/server/esign";
import { cronAuthorized } from "@/server/http";
import { getDb } from "@/server/runtime";
import { sendDueReminders } from "@/server/services/engagement";
import { sweepExpiredOffers } from "@/server/services/routing";

/**
 * Run every minute by the scheduler (Vercel Cron, a job queue, or n8n):
 * re-routes offers past their acceptance window, sends engagement reminders, and
 * runs the automation reconciler (nurture enrollment and CRM sync).
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const now = new Date();
  const offers = sweepExpiredOffers(db, now);
  const reminders = await sendDueReminders(db, esignProviderFromEnv(), now);
  const automations = await runAutomations(db, new CrmSync(crmAdapterFromEnv()), now);
  return NextResponse.json({ offers, reminders, automations });
}
