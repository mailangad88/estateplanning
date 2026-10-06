import { NextResponse } from "next/server";
import { clearPlanSessionCookie } from "@/server/services/familyPlan";

/** Signs out of the plan on this device. The saved plan stays until the visitor deletes it. */
export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.headers.append("set-cookie", clearPlanSessionCookie());
  return res;
}
