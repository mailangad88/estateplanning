import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const POPULAR: { href: string; label: string; note: string }[] = [
  { href: "/decide", label: "Will or trust? See it on a map", note: "Pick the plan that fits your family in a few clicks." },
  { href: "/tools", label: "Free calculators and tools", note: "Probate cost, who inherits, inheritance tax and more." },
  { href: "/free", label: "Free checklists and guides", note: "Printable worksheets for every step." },
  { href: "/learn", label: "Plain-English library", note: "Wills, trusts, powers of attorney, probate." },
  { href: "/pricing", label: "Flat-fee pricing", note: "What each package costs and includes." },
];

/** 404 page: sends a lost visitor (often from an old or mistyped link) to search, the top tools and booking. */
export default function NotFound() {
  return (
    <>
      <PageHeader kicker="404" art="SpotQuestions" title="We couldn't find that page" lead="The link may be old or mistyped. Search for what you need, or start from one of the pages below." />
      <form action="/search" method="get" role="search" className="not-found-search" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
        <input name="q" type="search" aria-label="Search the site" placeholder="Search guides, tools and checklists" style={{ flex: "1 1 16rem", minWidth: 0, padding: "0.7rem 0.9rem", borderRadius: 8, border: "1px solid var(--border)" }} />
        <button className="button" type="submit">Search</button>
      </form>
      <ul className="not-found-links" style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" }}>
        {POPULAR.map((p) => (
          <li key={p.href} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
            <Link href={p.href}><strong>{p.label}</strong></Link>
            <p style={{ margin: "0.35rem 0 0" }}>{p.note}</p>
          </li>
        ))}
      </ul>
      <aside className="cta" style={{ marginTop: "2rem" }}>
        <strong>Rather talk it through?</strong>
        <p>Pick a time and we will match you with an estate planning attorney in Illinois or New Jersey.</p>
        <Link className="button" href="/book?from=404">Book a consult</Link>
      </aside>
    </>
  );
}
