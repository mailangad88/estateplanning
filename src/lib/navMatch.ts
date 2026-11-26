/** The nav item a path belongs to: the longest matching href, so /admin/cases/x lights up "Case board". */
export function activeHref(hrefs: string[], path: string): string | undefined {
  return hrefs.filter((h) => path === h || path.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
}
