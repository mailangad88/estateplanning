export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; invalid?: string }> }) {
  const sp = await searchParams;
  if (sp.done) {
    return (
      <>
        <h1>You are unsubscribed</h1>
        <p>We will not send you these emails again. If you are working with our office on a case, we may still contact you about it directly.</p>
      </>
    );
  }
  if (sp.invalid || !sp.t) {
    return (
      <>
        <h1>This link has expired or is not valid</h1>
        <p>Reply to any of our emails with the word STOP, or call our office, and we will remove you.</p>
      </>
    );
  }
  return (
    <>
      <h1>Unsubscribe</h1>
      <p>Stop receiving follow-up emails from our office.</p>
      <form method="post" action="/api/unsubscribe">
        <input type="hidden" name="t" value={sp.t} />
        <button className="button">Unsubscribe</button>
      </form>
    </>
  );
}
