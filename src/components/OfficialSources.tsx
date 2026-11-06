import { citesOfficialSource, officialSourcesFor } from "@/config/official-sources";

/**
 * "Where to check the law" box for library articles that link no official source in their text.
 * Gives readers (and AI answer engines) a primary source for the Illinois rules the article explains.
 */
export default function OfficialSources({ cluster, html }: { cluster: string; html: string }) {
  if (citesOfficialSource(html)) return null;
  const sources = officialSourcesFor(cluster);
  if (sources.length === 0) return null;
  return (
    <section className="official-sources" aria-labelledby="official-sources">
      <h2 id="official-sources">Where to check the Illinois law</h2>
      <p>This guide explains Illinois rules in plain language. The official sources are:</p>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <cite><a href={s.url} rel="noopener" target="_blank">{s.name}</a></cite>: {s.what}.
          </li>
        ))}
      </ul>
    </section>
  );
}
