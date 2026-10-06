import { firm } from "@/config/firm";

export const metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default async function Welcome({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="container">
      <h1>Welcome</h1>
      {token ? (
        <form method="post" action="/api/client/accept" className="card">
          <p>Your attorney's office set up a private space for you. You can upload documents, send messages and see where things stand.</p>
          <input type="hidden" name="token" value={token} />
          <button className="button" type="submit">Open my space</button>
          <p className="notice">This link works once. We will ask for a second step to confirm it is you.</p>
        </form>
      ) : (
        <p>This link is missing something. Please use the link from your attorney's office, or call us at {firm.phone}.</p>
      )}
    </div>
  );
}
