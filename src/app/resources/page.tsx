import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Free estate planning guides and checklists",
  description: "Printable, plain-English checklists and guides for families planning ahead or handling a loved one's estate.",
};

export default function ResourcesPage() {
  return (
    <>
      <h1>Free guides and checklists</h1>
      <p className="lead">Plain-English, printable, and useful whether or not you ever hire us.</p>
      <ul className="card-grid">
        {GUIDES.map((g) => (
          <li className="card" key={g.slug}>
            <strong>{g.title}</strong>
            <p>{g.summary}</p>
            <p className="notice">About {g.pages} printed pages</p>
            <Link className="button small" href={`/resources/${g.slug}`}>Get the guide</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
