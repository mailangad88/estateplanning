"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

export interface LibraryItem {
  slug: string;
  title: string;
  promise: string;
  format: string;
  formatLabel: string;
  category: string;
  categoryLabel: string;
  pages: number;
  audience: string;
  lang: string;
}

function Card({ i }: { i: LibraryItem }) {
  return (
    <li>
      <Link href={`/free/${i.slug}`} className="card-link">
        <span className="tag">{i.formatLabel} · {i.lang === "es" ? "Español" : i.categoryLabel}</span>
        <strong lang={i.lang}>{i.title}</strong>
        <span className="card-desc">{i.promise}</span>
        <span className="meta" style={{ margin: 0 }}>{i.format === "email-course" ? "5 short emails" : `About ${i.pages} printed pages`} · Free</span>
      </Link>
    </li>
  );
}

/**
 * One topic of the library. Every card is in the HTML, so all of them stay crawlable; CSS shows
 * only the first few until the reader opens the group with "Show all".
 */
export function LibraryGroup({ id, label, count, children }: { id: string; label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = `${id}-list`;
  return (
    <section className={`library-group${open ? " is-open" : ""}`} aria-labelledby={id}>
      <div className="library-group__head">
        <h2 id={id}>{label}</h2>
        <span className="library-group__count">{count}</span>
      </div>
      <ul className="cards library-cards" id={listId}>{children}</ul>
      {count > 4 && (
        <button type="button" className="button secondary small library-group__more" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
          {open ? "Show fewer" : `Show all ${count}`}
        </button>
      )}
    </section>
  );
}

export default function Library({ items, categories, formats }: { items: LibraryItem[]; categories: Record<string, string>; formats: Record<string, string> }) {
  const [category, setCategory] = useState("all");
  const [format, setFormat] = useState("all");
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("all");

  const usedCategories = Object.entries(categories).filter(([k]) => items.some((i) => i.category === k));
  const usedFormats = Object.entries(formats).filter(([k]) => items.some((i) => i.format === k));
  const filtering = category !== "all" || format !== "all" || lang !== "all" || query.trim() !== "";
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (format === "all" || i.format === format) &&
        (lang === "all" || i.lang === lang) &&
        (!q || `${i.title} ${i.promise} ${i.audience}`.toLowerCase().includes(q)),
    );
  }, [items, category, format, query, lang]);
  const groups = usedCategories.map(([k, v]) => ({ key: k, label: v, items: items.filter((i) => i.category === k) }));

  return (
    <>
      <div className="library-filters">
        <label className="field">
          Search
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Guardian, trust, executor…" />
        </label>
        <label className="field">
          Topic
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All topics</option>
            {usedCategories.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">
          Type
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="all">All types</option>
            {usedFormats.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">
          Language
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="all">All</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </div>
      <p className="meta" aria-live="polite">{shown.length} of {items.length} resources</p>
      {filtering ? (
        <ul className="cards library-cards">
          {shown.map((i) => <Card key={i.slug} i={i} />)}
        </ul>
      ) : (
        <>
          <nav className="library-jump" aria-label="Jump to a topic">
            <ul>
              {groups.map((g) => (
                <li key={g.key}><a href={`#topic-${g.key}`}>{g.label} <span>{g.items.length}</span></a></li>
              ))}
            </ul>
          </nav>
          {groups.map((g) => (
            <LibraryGroup key={g.key} id={`topic-${g.key}`} label={g.label} count={g.items.length}>
              {g.items.map((i) => <Card key={i.slug} i={i} />)}
            </LibraryGroup>
          ))}
        </>
      )}
    </>
  );
}
