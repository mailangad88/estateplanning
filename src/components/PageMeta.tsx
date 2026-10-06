import Link from "next/link";
import { firm } from "@/config/firm";
import { site } from "@/config/site";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Byline with the review status. Approved pages name the attorney who reviewed them and when; pending pages
 * say whose review they are waiting on. The attorney's name links to the profile page, the page Google and AI
 * engines use to confirm who stands behind the content.
 */
export default function PageMeta({ updated, words, reviewed = false }: { updated: string; words?: number; reviewed?: boolean }) {
  const attorney = <Link href="/about-the-attorney" rel="author">{firm.attorneyName}</Link>;
  return (
    <p className="page-meta">
      <span className="review-badge">{reviewed ? "Attorney reviewed" : site.reviewStatus}</span>{" "}
      {reviewed ? (
        <>
          Reviewed by {attorney}, {firm.attorneyTitle.toLowerCase()}
          {updated && <> on <time dateTime={updated}>{formatDate(updated)}</time></>}.
        </>
      ) : (
        <>
          Written by our editorial team for review by {attorney}.
          {updated && <> Updated <time dateTime={updated}>{formatDate(updated)}</time>.</>}
        </>
      )}
      {words ? <> {Math.max(1, Math.round(words / 230))} min read.</> : null}{" "}
      General education, <Link href="/legal/disclaimer">not legal advice</Link>.
    </p>
  );
}
