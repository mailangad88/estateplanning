/** Pagefind's browser API (public/pagefind/pagefind.js, built by scripts/build-search-index.mts). Browser only. */
export interface PagefindHit {
  url: string;
  excerpt: string;
  meta: { title?: string; section?: string };
}

export interface Pagefind {
  init(): Promise<void>;
  search(q: string, opts?: object): Promise<{ results: { id: string; data(): Promise<PagefindHit> }[] } | null>;
  debouncedSearch(q: string, opts?: object, ms?: number): Promise<{ results: { id: string; data(): Promise<PagefindHit> }[] } | null>;
}

let loader: Promise<Pagefind> | null = null;

/** Loads the search index once per page view. Rejects when the index was not built (plain `next dev`). */
export function loadPagefind(): Promise<Pagefind> {
  const src = "/pagefind/pagefind.js";
  loader ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ src).then(async (pf: Pagefind) => {
    await pf.init();
    return pf;
  });
  loader.catch(() => {
    loader = null;
  });
  return loader;
}
