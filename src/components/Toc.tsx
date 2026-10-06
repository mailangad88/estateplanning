import type { Heading } from "@/lib/content";

export default function Toc({ headings }: { headings: Heading[] }) {
  if (headings.length < 3) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ol>
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
