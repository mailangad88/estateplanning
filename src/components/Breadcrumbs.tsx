import Link from "next/link";

export interface Crumb {
  name: string;
  url: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol>
        {items.map((c, i) => (
          <li key={c.url}>
            {i < items.length - 1 ? <Link href={c.url}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
