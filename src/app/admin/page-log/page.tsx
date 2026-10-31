import Link from "next/link";
import { can } from "@/server/auth/policy";
import { currentActor } from "@/server/runtime";
import log from "../../../../content/page-log.json";
import styles from "./page-log.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Page improvement log", robots: { index: false, follow: false } };

const GROUPS = { complete: "Completeness", seo: "SEO", aeo: "AEO", geo: "GEO", visuals: "Visuals", faq: "FAQs", links: "Links", cta: "Booking CTA", trust: "Trust" } as const;
type Group = keyof typeof GROUPS;
type Row = (typeof log.rows)[number] & { note?: string };
type Search = { section?: string; gap?: string; q?: string; sort?: string; page?: string };
const PER_PAGE = 100;

function hrefWith(sp: Search, patch: Partial<Search>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/admin/page-log?${s}` : "/admin/page-log";
}

const tone = (n: number) => (n < 60 ? styles.low : n < 80 ? styles.mid : "");

/** The shared scoreboard: every indexable page against one checklist, biggest gaps first. Read-only. */
export default async function PageLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_reports")) return <p>The page log is for marketing and admins.</p>;
  const sp = await searchParams;
  const s = log.summary;

  let rows = log.rows as Row[];
  if (sp.section) rows = rows.filter((r) => r.section === sp.section);
  if (sp.gap) rows = rows.filter((r) => r.remaining.includes(sp.gap!));
  if (sp.q) rows = rows.filter((r) => r.path.includes(sp.q!) || r.title.toLowerCase().includes(sp.q!.toLowerCase()));
  if (sp.sort === "score") rows = [...rows].sort((a, b) => a.score - b.score);
  else if (sp.sort === "stale") rows = [...rows].sort((a, b) => (a.lastTouched || "").localeCompare(b.lastTouched || ""));
  else if (sp.sort === "value") rows = [...rows].sort((a, b) => b.value - a.value);
  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <h1>Page improvement log</h1>
      <p className="notice">
        Generated {s.generated} from the built site by <code>npm run page-log</code>. {s.pages} indexable pages, average score {s.score}/100. Priority is page value
        (lead and local intent, search value) times the gap. Re-run after changing pages; notes go in <code>content/page-log-notes.json</code>.
        {s.shallowGit ? " Last-touched dates came from a shallow git checkout and are not reliable." : ""}
      </p>

      <div className={styles.cards}>
        {(Object.keys(GROUPS) as Group[]).map((g) => {
          const v = (s.groups as Record<Group, number>)[g];
          return (
            <div key={g} className={`${styles.card} ${tone(v)}`}>
              <span>{GROUPS[g]}</span>
              <b>{v}</b>
              <div className={styles.bar}><i style={{ width: `${v}%` }} /></div>
            </div>
          );
        })}
      </div>

      <div className={styles.cards}>
        {[
          ["Text-only pages", s.textOnly],
          ["No interactive tool", s.noInteractive],
          ["No FAQs", s.noFaq],
          ["No booking link in body", s.noBook],
          ["Fewer than 3 inbound links", s.orphans],
          ["Waiting for attorney", s.unreviewed],
          ["NJ pages held", s.heldNJ],
          ["Unanswered questions", s.openQuestions],
        ].map(([label, n]) => (
          <div key={label} className={styles.card}><span>{label}</span><b>{n}</b></div>
        ))}
      </div>

      <h2>Most common gaps</h2>
      <div className={styles.wrap}>
        <table>
          <thead><tr><th>Check</th><th>Area</th><th>Pages failing</th></tr></thead>
          <tbody>
            {log.checks.filter((c) => c.failing > 0).map((c) => (
              <tr key={c.id}>
                <td><Link href={hrefWith({}, { gap: c.label })}>{c.label}</Link></td>
                <td>{GROUPS[c.group as Group]}</td>
                <td>{c.failing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>By section</h2>
      <div className={styles.wrap}>
        <table>
          <thead><tr><th>Section</th><th>Pages</th><th>Score</th><th>No FAQ</th><th>Unapproved</th><th>Last touched</th></tr></thead>
          <tbody>
            {log.sections.map((x) => (
              <tr key={x.section}>
                <td><Link href={hrefWith({}, { section: x.section })}>{x.section}</Link></td>
                <td>{x.pages}</td>
                <td className={styles.score}>{x.score}</td>
                <td>{x.noFaq}</td>
                <td>{x.unreviewed}</td>
                <td>{x.lastTouched}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="pages">Pages</h2>
      <form className={styles.filters} method="get" action="/admin/page-log#pages">
        <label>Section
          <select name="section" defaultValue={sp.section ?? ""}>
            <option value="">All sections</option>
            {log.sections.map((x) => <option key={x.section} value={x.section}>{x.section}</option>)}
          </select>
        </label>
        <label>Failing check
          <select name="gap" defaultValue={sp.gap ?? ""}>
            <option value="">Any</option>
            {log.checks.filter((c) => c.failing > 0).map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
          </select>
        </label>
        <label>Sort
          <select name="sort" defaultValue={sp.sort ?? ""}>
            <option value="">Biggest gap first</option>
            <option value="score">Lowest score</option>
            <option value="value">Highest value</option>
            <option value="stale">Longest untouched</option>
          </select>
        </label>
        <label>Path or title<input name="q" defaultValue={sp.q ?? ""} /></label>
        <button type="submit">Filter</button>
        {(sp.section || sp.gap || sp.q || sp.sort) && <Link href="/admin/page-log#pages">Clear</Link>}
      </form>
      <p className="notice">{rows.length} pages match. Page {page} of {pages}.</p>
      <div className={`${styles.wrap} ${styles.full}`}>
        <table>
          <thead><tr><th>Page</th><th>Score</th><th>Value</th><th>Visuals</th><th>FAQ</th><th>Approved</th><th>Last touched</th><th>Still to do</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.path}>
                <td><Link href={r.path}>{r.path}</Link><div className={styles.todo}>{r.section}</div></td>
                <td className={styles.score}>{r.score}</td>
                <td>{r.value}</td>
                <td>{r.visuals + r.interactive}</td>
                <td>{r.faqs ? "yes" : "no"}</td>
                <td>{r.reviewed === null ? "n/a" : r.reviewed ? "yes" : "no"}</td>
                <td className={styles.nowrap}>{r.lastTouched}</td>
                <td className={styles.todo}>
                  {r.remaining.join("; ") || "Nothing on the checklist"}
                  {r.note ? <div>Note: {r.note}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pager}>
        {page > 1 && <Link href={hrefWith(sp, { page: String(page - 1) }) + "#pages"}>Previous</Link>}
        {page < pages && <Link href={hrefWith(sp, { page: String(page + 1) }) + "#pages"}>Next</Link>}
      </div>
    </>
  );
}
