import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { enrollMfa, mfaStatus, PREAUTH_COOKIE, readPreauth } from "@/server/auth/flow";
import { getDb } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify", robots: { index: false, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const uid = readPreauth((await cookies()).get(PREAUTH_COOKIE)?.value);
  const user = uid ? await (await getDb()).users.get(uid) : null;
  if (!uid || !user) redirect("/portal/login?expired=1");

  const status = await mfaStatus(uid);
  // A pending (unconfirmed) setup is replaced on each load, so always scan the newest secret.
  const setup = status === "enrolled" ? null : await enrollMfa(uid, user.email);

  return (
    <>
      <h1>Two-step verification</h1>
      {sp.error === "locked" && <p className="error" role="alert">Too many wrong codes. Try again in 15 minutes.</p>}
      {sp.error === "bad_code" && <p className="error" role="alert">That code did not work. Check the time on your phone and try again.</p>}
      {setup && (
        <section className="card" aria-labelledby="setup">
          <h2 id="setup">Set up your authenticator</h2>
          <p>Add this account in an authenticator app by entering the key below, or open the setup link on your phone.</p>
          <p>Key: <code>{setup.secret}</code></p>
          <p className="notice">Setup link: <code>{setup.otpauthUrl}</code></p>
          <h3>Recovery codes</h3>
          <p className="notice">Save these now. Each works once if you lose your phone. They are not shown again.</p>
          <ul>{setup.recoveryCodes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
        </section>
      )}
      <form method="post" action="/api/auth/verify" className="card">
        <label className="field">
          {setup ? "Enter the 6-digit code to finish setup" : "6-digit code, or a recovery code"}
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <button className="button">Verify</button>
      </form>
    </>
  );
}
