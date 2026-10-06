import type { Metadata } from "next";
import { cookies } from "next/headers";
import { firm } from "@/config/firm";
import { getDb } from "@/server/runtime";
import { familyPlanConfigured, loadOwnPlan, PLAN_PREAUTH_COOKIE, readPlanPreauth, type OwnPlan } from "@/server/services/familyPlan";
import { PLAN_SESSION_COOKIE, resolvePlanSession } from "@/server/services/planAccount";
import FamilyPlanner from "./FamilyPlanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My family plan",
  description: "Organize your people, what you own and the documents you already have in one place, then bring the picture to an attorney.",
  robots: { index: false, follow: false },
};

export default async function MyPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const configured = familyPlanConfigured();
  const jar = await cookies();
  let initial: OwnPlan | null = null;
  let pendingCode = false;
  if (configured) {
    try {
      const ctx = await resolvePlanSession(await getDb(), jar.get(PLAN_SESSION_COOKIE)?.value);
      if (ctx) initial = await loadOwnPlan(ctx.db, ctx.planId);
      else pendingCode = !!readPlanPreauth(jar.get(PLAN_PREAUTH_COOKIE)?.value);
    } catch (err) {
      console.error("family plan load failed", err instanceof Error ? err.message : "unknown error");
    }
  }
  const saved = sp.saved === "new" || sp.saved === "back" ? sp.saved : undefined;
  const notice = sp.ended === "deleted" || sp.ended === "signed_out" || sp.ended === "timeout" ? sp.ended : undefined;
  return (
    <FamilyPlanner
      initial={initial}
      configured={configured}
      saved={saved}
      linkExpired={sp.link === "expired"}
      pendingCode={pendingCode}
      ended={notice}
      phone={firm.phone}
    />
  );
}
