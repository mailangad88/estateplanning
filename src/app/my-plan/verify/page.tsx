import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/runtime";
import { PLAN_PREAUTH_COOKIE } from "@/server/services/familyPlan";
import { beginPlanEnrolment, formatSecret, planSignInStatus } from "@/server/services/planAccount";
import styles from "../FamilyPlanner.module.css";
import VerifyClient from "./VerifyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Two-step verification",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * After the email link: set up an authenticator (first sign-in) or enter a code. Nothing from the plan
 * is loaded here; the plan opens only once a code passes.
 */
export default async function VerifyPage() {
  const pre = (await cookies()).get(PLAN_PREAUTH_COOKIE)?.value;
  const db = await getDb();
  const status = await planSignInStatus(db, pre);
  if (status === "no_preauth") redirect("/my-plan?link=expired");
  let setup: { secret: string; otpauthUrl: string } | undefined;
  if (status === "enrol") {
    const r = await beginPlanEnrolment(db, pre);
    if (!r.ok) redirect("/my-plan?link=expired");
    setup = { secret: formatSecret(r.secret), otpauthUrl: r.otpauthUrl };
  }
  return (
    <div className={styles.wrap}>
      <VerifyClient setup={setup} />
    </div>
  );
}
