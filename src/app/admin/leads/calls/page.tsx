import Link from "next/link";
import { Phone } from "lucide-react";
import { callList, CONTACT_RESULTS } from "@/server/services/leadDesk";
import { agoShort, loadDesk, phoneDisplay } from "../data";
import { StatusPill } from "../widgets";
import styles from "../desk.module.css";

export const dynamic = "force-dynamic";

export default async function CallList({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const desk = await loadDesk();
  if (!desk.ok) return null;
  const { rows, now } = desk;
  const sp = await searchParams;
  const list = callList(rows);
  return (
    <>
      <p className={styles.kicker}>Daily</p>
      <h1>Call list <span className={styles.count}>{list.length}</span></h1>
      {sp.ok && <p className={styles.ok} role="status">{sp.ok}</p>}
      {sp.error && <p className={styles.alert} role="alert">{sp.error}</p>}
      <p className={styles.sub} style={{ marginBottom: 16 }}>
        Everyone nobody has reached yet, urgent and longest-waiting first, then people you&apos;ve talked to once who still need an attorney match.
        Up to six tries over ten days, then close the lead as no reply.
      </p>
      {list.length === 0 ? <p className={styles.empty}>No calls to make. Nice.</p> : (
        <ul className={styles.items} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "4px 20px" }}>
          {list.map((r) => (
            <li key={r.id} className={styles.item}>
              <span className={styles.itemIcon} data-kind={r.waitingMinutes !== null ? "fix" : "yours"}><Phone size={17} aria-hidden="true" /></span>
              <div>
                <Link className={styles.itemTitle} href={`/admin/leads/${r.id}`}>{r.name}</Link>{" "}
                <StatusPill status={r.status} />
                {(r.urgent || r.afterDeath) && <span className={styles.tag}>Urgent</span>}
                <p className={styles.itemDetail}>
                  {r.matter} · {r.toolLabel} · {r.county ? `${r.county} County` : r.state} · {r.attempts} tr{r.attempts === 1 ? "y" : "ies"} so far · came in {agoShort(r.createdAt, now)}
                  {r.afterDeath && " · lost someone: listen first, no sales script"}
                </p>
                <form method="post" action={`/api/admin/leads/${r.id}/contact?back=calls`} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <input type="hidden" name="kind" value="call" />
                  <input type="hidden" name="back" value="calls" />
                  {Object.entries(CONTACT_RESULTS).filter(([k]) => k !== "sent").map(([k, v]) => (
                    <button key={k} name="result" value={k} className={`${styles.btn} ${styles.btnGhost}`} style={{ padding: "5px 12px", fontSize: "0.8rem" }} type="submit">{v}</button>
                  ))}
                </form>
              </div>
              <div className={styles.itemSide}>
                <a className={styles.btn} href={`tel:+1${r.phone}`}><Phone size={15} aria-hidden="true" /> {phoneDisplay(r.phone)}</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
