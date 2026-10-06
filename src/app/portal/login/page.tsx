export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; expired?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      {sp.sent && <p className="notice" role="status">If that address has an account, a sign-in link is on its way. It works once and expires in 15 minutes.</p>}
      {sp.expired && <p className="error" role="alert">That link or session has expired. Request a new link.</p>}
      <form method="post" action="/api/auth/login" className="card">
        <label className="field">
          Work email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <button className="button">Email me a sign-in link</button>
        <p className="notice">After the link you will enter a code from your authenticator app.</p>
      </form>
    </>
  );
}
