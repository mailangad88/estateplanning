import Link from "next/link";
import type { SiteLink } from "@/lib/site-links";

/** Free tools and printable checklists for the topic, shown on library pages. */
export default function ToolsBox({ items }: { items: SiteLink[] }) {
  if (!items.length) return null;
  return (
    <aside className="tools-box" aria-labelledby="free-tools">
      <h2 id="free-tools">Free tools for this topic</h2>
      <ul className="cards">
        {items.map((t) => (
          <li key={t.url}>
            <Link href={t.url} className="card-link">
              <span className="tag">{t.kind}</span>
              <strong>{t.title}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
