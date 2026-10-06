"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/components/capture";

/** Pagefind's browser API (public/pagefind/pagefind.js, built by scripts/build-search-index.mts). */
interface Pagefind {
  init(): Promise<void>;
  debouncedSearch(q: string, opts?: object, ms?: number): Promise<{ results: { id: string; data(): Promise<Hit> }[] } | null>;
}
interface Hit {
  url: string;
  excerpt: string;
  meta: { title?: string; section?: string };
}

let loader: Promise<Pagefind> | null = null;
function loadPagefind(): Promise<Pagefind> {
  const src = "/pagefind/pagefind.js";
  loader ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ src).then(async (pf: Pagefind) => {
    await pf.init();
    return pf;
  });
  return loader;
}

const MAX_RESULTS = 20;

export default function SiteSearch() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    window.history.replaceState(null, "", q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    if (q.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    loadPagefind()
      .then((pf) => pf.debouncedSearch(q, {}, 250))
      .then(async (res) => {
        if (!res || cancelled) return; // superseded by a newer query
        const data = await Promise.all(res.results.slice(0, MAX_RESULTS).map((r) => r.data()));
        if (cancelled) return;
        setHits(data);
        // Zero-result queries show content gaps. track() strips sensitive terms before sending.
        track("search", { search_term: q.slice(0, 80), results: res.results.length });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <section className="site-search" aria-label="Search the site">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="site-search-q">Search the site</label>
        <input
          id="site-search-q"
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: living trust cost, executor duties, power of attorney"
          autoComplete="off"
        />
      </form>
      {error && (
        <p>
          Search is not available right now. Browse the <Link href="/learn">library</Link> or the{" "}
          <Link href="/resources">resource hub</Link> instead.
        </p>
      )}
      {hits && hits.length === 0 && (
        <p>
          Nothing matched &ldquo;{query.trim()}&rdquo;. Try a shorter phrase, browse the <Link href="/glossary">glossary</Link>, or{" "}
          <Link href="/plan-finder">tell us what you are dealing with</Link>.
        </p>
      )}
      {hits && hits.length > 0 && (
        <ol className="cards search-results">
          {hits.map((h) => (
            <li key={h.url}>
              <Link href={h.url} className="card-link">
                {h.meta.section && <span className="tag">{h.meta.section}</span>}
                <strong>{h.meta.title ?? h.url}</strong>
                {/* Pagefind excerpts are escaped text from our own pages with <mark> around matches. */}
                <span className="card-desc" dangerouslySetInnerHTML={{ __html: h.excerpt }} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
