import { firm } from "@/config/firm";

export const metadata = { title: "Welcome", robots: { index: false, follow: false } };

/** Only a client page may be the landing spot after sign-in. */
const safeNext = (n?: string) => (n && /^\/client(\/[\w-]+)*$/.test(n) ? n : undefined);

export default async function Welcome({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token, next } = await searchParams;
  const target = safeNext(next);
  const signing = !!target?.startsWith("/client/sign/");
  return (
    <div className="container">
      <h1>Welcome</h1>
      {token ? (
        <form method="post" action="/api/client/accept" className="card">
          <p>
            {signing
              ? "Your attorney's office sent your engagement agreement. Open it to read a plain-language summary and the full agreement, then sign online."
              : "Your attorney's office set up a private space for you. You can upload documents, send messages and see where things stand."}
          </p>
          <input type="hidden" name="token" value={token} />
          {target && <input type="hidden" name="next" value={target} />}
          <button className="button" type="submit">{signing ? "Open my agreement" : "Open my space"}</button>
          <p className="notice">This link works once. We will ask for a second step to confirm it is you.</p>
        </form>
      ) : (
        <p>This link is missing something. Please use the link from your attorney&apos;s office, or call us at {firm.phone}.</p>
      )}
    </div>
  );
}
