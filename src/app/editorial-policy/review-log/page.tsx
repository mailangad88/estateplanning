import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { REVIEW_PROCESS, REVIEW_SIGNOFFS } from "@/config/review-log";
import { getChecklists, getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Content review log",
  description: "How drafts on this site, including AI-assisted drafts, are checked and approved by the attorney, and the review status of every page.",
  alternates: { canonical: "/editorial-policy/review-log" },
};

interface Row {
  path: string;
  title: string;
  reviewed: boolean;
  updated: string;
}

function rows(): Row[] {
  const out: Row[] = [];
  const add = (base: string, items: { slug: string; title: string; reviewed: boolean; updated: string }[]) =>
    items.forEach((i) => out.push({ path: `${base}/${i.slug}`, title: i.title, reviewed: i.reviewed, updated: i.updated }));
  add("/guides", getGuides());
  add("/blog", getPosts());
  add("/compare", getComparisons());
  add("/life-events", getLifeEvents());
  add("/checklists", getChecklists());
  return out;
}

export default function ReviewLog() {
  const all = rows();
  const reviewed = all.filter((r) => r.reviewed).length;
  return (
    <>
      <PageHeader kicker="Review status" art="SpotDocumentsSigned"
        title="Content review log"
        lead="How a draft becomes a page we stand behind, and where every page stands today."
      />
      <h2>How drafts are reviewed</h2>
      <ol>
        {REVIEW_PROCESS.map((s) => (
          <li key={s.step}>
            <strong>{s.step}</strong> ({s.who}): {s.detail}
          </li>
        ))}
      </ol>

      <h2>Attorney sign-offs</h2>
      {REVIEW_SIGNOFFS.length === 0 ? (
        <p>No pages have been signed off by {firm.attorneyName} yet. Every page below shows &quot;Draft pending attorney review&quot; until it is.</p>
      ) : (
        <ul>
          {REVIEW_SIGNOFFS.map((s) => (
            <li key={`${s.path}-${s.date}`}>
              <Link href={s.path}>{s.path}</Link>: {s.reviewedBy}, {s.date} (version {s.version}){s.notes ? `. ${s.notes}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h2>Page status</h2>
      <p>
        {reviewed} of {all.length} pages reviewed by the attorney.
      </p>
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.path}>
              <td>
                <Link href={r.path}>{r.title}</Link>
              </td>
              <td>{r.reviewed ? "Reviewed" : "Draft pending attorney review"}</td>
              <td>{r.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Link href="/editorial-policy">Back to the editorial policy</Link>
      </p>
    </>
  );
}
