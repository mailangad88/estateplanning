import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/runtime";
import { accountOverview, PLAN_SESSION_COOKIE, PLAN_SESSION_ABSOLUTE_S, PLAN_SESSION_IDLE_S, resolvePlanSession } from "@/server/services/planAccount";
import styles from "../FamilyPlanner.module.css";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account and security",
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await resolvePlanSession(await getDb(), (await cookies()).get(PLAN_SESSION_COOKIE)?.value);
  if (!ctx) redirect("/my-plan?ended=timeout");
  const overview = await accountOverview(ctx);
  return (
    <div className={styles.wrap}>
      <AccountClient
        initial={overview}
        usedRecoveryCode={sp.recovery === "used"}
        idleMinutes={PLAN_SESSION_IDLE_S / 60}
        maxDays={PLAN_SESSION_ABSOLUTE_S / 86_400}
      />
    </div>
  );
}
