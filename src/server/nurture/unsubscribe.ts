import { readToken } from "@/server/auth/identity";
import type { CrmSync } from "@/server/crm/sync";
import type { Db } from "@/server/db";
import { applyOptOut } from "@/server/nurture/compliance";
import { UNSUB_PURPOSE, type UnsubscribePayload } from "@/server/nurture/sender";

/** Applies the opt-out a signed unsubscribe link asks for. False when the link is not valid. */
export async function unsubscribeWithToken(db: Db, token: string | null | undefined, now = new Date(), crm: CrmSync | null = null): Promise<boolean> {
  const p = readToken<UnsubscribePayload>(UNSUB_PURPOSE, token ?? undefined);
  if (!p || typeof p.p !== "string" || (p.c !== "email" && p.c !== "sms")) return false;
  const person = await db.persons.get(p.p);
  if (!person) return false;
  const address = p.c === "email" ? person.email : person.phone;
  if (!address) return true;
  await applyOptOut(db, { channel: p.c, address, text: "unsubscribe", at: now });
  // Tell the CRM so its own campaigns stop too. A CRM outage must not fail the unsubscribe: it is recorded locally above.
  if (crm) await crm.syncPersonSuppression(db, person.id);
  return true;
}
