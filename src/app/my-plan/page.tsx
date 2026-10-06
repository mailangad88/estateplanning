import type { Metadata } from "next";
import { cookies } from "next/headers";
import { firm } from "@/config/firm";
import { getDb, plannerDb } from "@/server/runtime";
import { familyPlanConfigured, loadOwnPlan, PLAN_SESSION_COOKIE, readPlanSession, type OwnPlan } from "@/server/services/familyPlan";
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
  const planId = configured ? readPlanSession(jar.get(PLAN_SESSION_COOKIE)?.value) : null;
  let initial: OwnPlan | null = null;
  if (planId) {
    try {
      initial = await loadOwnPlan(plannerDb(await getDb(), planId), planId);
    } catch (err) {
      console.error("family plan load failed", err instanceof Error ? err.message : "unknown error");
    }
  }
  const saved = sp.saved === "new" || sp.saved === "back" ? sp.saved : undefined;
  return <FamilyPlanner initial={initial} configured={configured} saved={saved} linkExpired={sp.link === "expired"} phone={firm.phone} />;
}
