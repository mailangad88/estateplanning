"use client";

import Link from "next/link";
import { useState } from "react";
import base from "../FamilyPlanner.module.css";
import { AuthenticatorSetup, CodeForm, errorText, postJson, RecoveryCodes } from "../AccountParts";

/**
 * The code step. First sign-in: set up an authenticator, confirm it with a code, then save the recovery
 * codes (shown once). Later sign-ins: a code from the app, or a recovery code.
 */
export default function VerifyClient({ setup }: { setup?: { secret: string; otpauthUrl: string } }) {
  const [codes, setCodes] = useState<string[] | null>(null);

  async function submit(code: string): Promise<string | null> {
    const r = await postJson("/api/my-plan/verify", { code });
    if (r.status === 401) {
      window.location.assign("/my-plan?link=expired");
      return null;
    }
    if (!r.ok) return errorText(r.data);
    const recovery = Array.isArray(r.data.recoveryCodes) ? (r.data.recoveryCodes as string[]) : null;
    if (recovery?.length) {
      setCodes(recovery);
      return null;
    }
    // A recovery code was used: go to the account page, where a new phone can be set up.
    window.location.assign(r.data.usedRecoveryCode ? "/my-plan/account?recovery=used" : "/my-plan?saved=back");
    return null;
  }

  if (codes) {
    return (
      <>
        <header className={base.hero}>
          <p className={base.kicker}>Step 2 of 2</p>
          <h1>Two-step verification is on</h1>
        </header>
        <RecoveryCodes codes={codes} doneLabel="Continue to my plan" onDone={() => window.location.assign("/my-plan?saved=new")} />
      </>
    );
  }

  if (setup) {
    return (
      <>
        <header className={base.hero}>
          <p className={base.kicker}>Step 1 of 2</p>
          <h1>Set up two-step verification</h1>
          <p className="lead">
            Your plan holds details about your family, so it gets a second lock. Each time you sign in, after the email link, you will
            enter a 6-digit code from an app on your phone. It takes about a minute to set up, once.
          </p>
        </header>
        <section className={base.card} aria-labelledby="fp-setup-h">
          <h2 id="fp-setup-h">Connect an authenticator app</h2>
          <AuthenticatorSetup secret={setup.secret} otpauthUrl={setup.otpauthUrl} />
          <CodeForm label="6-digit code from your app" submitLabel="Turn on two-step verification" onSubmit={submit} />
        </section>
        <p className="notice">
          Nothing you typed into the organizer has been saved yet. It stays on this device until this step is done. <Link href="/my-plan">Back to the organizer</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <header className={base.hero}>
        <p className={base.kicker}>Your organizer</p>
        <h1>Enter your code</h1>
        <p className="lead">Open your authenticator app and type the 6-digit code for your family plan.</p>
      </header>
      <section className={base.card} aria-labelledby="fp-code-h">
        <h2 id="fp-code-h">Two-step verification</h2>
        <CodeForm label="6-digit code from your app" submitLabel="Open my plan" allowRecovery onSubmit={submit} />
        <p className="notice">Lost your phone? Use one of the recovery codes you saved when you set this up. Each works once.</p>
      </section>
    </>
  );
}
