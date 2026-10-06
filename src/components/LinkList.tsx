import Link from "next/link";

export interface LinkItem {
  url: string;
  title: string;
  description?: string;
}

/** A titled list of links with optional one-line descriptions, used for related reading and hubs. */
export default function LinkList({ title, items, id }: { title: string; items: LinkItem[]; id?: string }) {
  if (!items.length) return null;
  return (
    <section className="link-list" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul>
        {items.map((i) => (
          <li key={i.url}>
            <Link href={i.url}>{i.title}</Link>
            {i.description && <span className="desc">{i.description}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
