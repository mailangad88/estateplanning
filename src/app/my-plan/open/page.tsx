import type { Metadata } from "next";
import styles from "../FamilyPlanner.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open my family plan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Landing page for the emailed link. Nothing is used up by loading it, so an email scanner that
 * fetches the link cannot spend it; the visitor's own click on the button does (POST /api/my-plan/link).
 */
export default async function OpenPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.slice(0, 2000) : "";
  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-labelledby="fp-open-h">
        <p className={styles.kicker}>Your organizer</p>
        <h1 id="fp-open-h" className={styles.openTitle}>Open your family plan</h1>
        {token ? (
          <form method="post" action="/api/my-plan/link">
            <input type="hidden" name="token" value={token} />
            <p>
              Press the button to continue on this device. Next you will enter a code from your authenticator app, or set one up if this is
              your first time. The link works once; after that, ask for a new one from the organizer.
            </p>
            <button type="submit" className="button">Continue</button>
          </form>
        ) : (
          <p>This link is missing its code. <a href="/my-plan">Go back to the organizer</a> and ask for a new link.</p>
        )}
      </section>
    </div>
  );
}
