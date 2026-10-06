import { assertCan, can } from "@/server/auth/policy";
import { factAlerts, listFactRows } from "@/server/facts/verify";
import { withActor } from "@/server/http";

export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    assertCan(can(actor, "verify_facts"));
    const now = new Date();
    return { facts: await listFactRows(db, actor, now), alerts: await factAlerts(db, now) };
  });
}
