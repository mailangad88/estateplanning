import Link from "next/link";
import { site } from "@/config/site";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Byline with the review status. Every content page shows this until the attorney approves it. */
export default function PageMeta({ updated, words }: { updated: string; words?: number }) {
  return (
    <p className="page-meta">
      <span className="review-badge">{site.reviewStatus}</span>
      {updated && <> Updated <time dateTime={updated}>{formatDate(updated)}</time>.</>}
      {words ? <> {Math.max(1, Math.round(words / 230))} min read.</> : null}{" "}
      General education, <Link href="/legal/disclaimer">not legal advice</Link>.
    </p>
  );
}
