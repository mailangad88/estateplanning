"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface Item {
  slug: string;
  title: string;
  promise: string;
  format: string;
  formatLabel: string;
  category: string;
  categoryLabel: string;
  pages: number;
  audience: string;
}

export default function Library({ items, categories, formats }: { items: Item[]; categories: Record<string, string>; formats: Record<string, string> }) {
  const [category, setCategory] = useState("all");
  const [format, setFormat] = useState("all");
  const [query, setQuery] = useState("");

  const usedCategories = Object.entries(categories).filter(([k]) => items.some((i) => i.category === k));
  const usedFormats = Object.entries(formats).filter(([k]) => items.some((i) => i.format === k));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (format === "all" || i.format === format) &&
        (!q || `${i.title} ${i.promise} ${i.audience}`.toLowerCase().includes(q)),
    );
  }, [items, category, format, query]);

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
      </div>
      <p className="meta" aria-live="polite">{shown.length} of {items.length} resources</p>
      <ul className="cards">
        {shown.map((i) => (
          <li key={i.slug}>
            <Link href={`/free/${i.slug}`} className="card-link">
              <span className="tag">{i.formatLabel} · {i.categoryLabel}</span>
              <strong>{i.title}</strong>
              <span className="card-desc">{i.promise}</span>
              <span className="meta" style={{ margin: 0 }}>{i.format === "email-course" ? "5 short emails" : `About ${i.pages} printed pages`} · Free</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
