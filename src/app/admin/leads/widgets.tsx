import Link from "next/link";
import { AlertTriangle, CircleHelp, Sparkles } from "lucide-react";
import { DESK_STATUS_LABELS, type DeskItem, type DeskStatus } from "@/server/services/leadDesk";
import { agoShort } from "./data";
import styles from "./desk.module.css";

const TAG: Record<DeskItem["kind"], string | null> = { fix: "Fix now", yours: "Your call", update: null };

export function ItemRow({ item, now, compact = false }: { item: DeskItem; now: Date; compact?: boolean }) {
  const Icon = item.kind === "fix" ? AlertTriangle : item.kind === "yours" ? CircleHelp : Sparkles;
  const tag = TAG[item.kind];
  return (
    <li className={`${styles.item} ${compact ? styles.itemCompact : ""}`}>
      <span className={styles.itemIcon} data-kind={item.kind}><Icon size={17} aria-hidden="true" /></span>
      <div>
        <Link className={styles.itemTitle} href={`/admin/leads/${item.leadId}`}>{item.title}</Link>
        <p className={styles.itemDetail}>
          {item.detail}
          {tag && !compact && <span className={styles.tag} data-kind={item.kind}>{tag}</span>}
        </p>
      </div>
      <div className={styles.itemSide}>
        <span>{agoShort(item.at, now)}</span>
        {item.action && !compact && (
          <a className={`${styles.btn} ${item.kind === "yours" ? styles.btnGhost : ""}`} href={item.action.href}>{item.action.label}</a>
        )}
      </div>
    </li>
  );
}

export const STATUS_COLORS: Record<Exclude<DeskStatus, "closed">, string> = {
  new: "var(--cta)",
  talking: "var(--brand)",
  consult: "var(--gold)",
  retained: "var(--sage)",
};

/** Donut of open leads by status. Each segment is a stroke-dasharray arc on one circle. */
export function Donut({ counts }: { counts: Record<DeskStatus, number> }) {
  const keys = Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[];
  const total = keys.reduce((t, k) => t + counts[k], 0);
  const r = 44;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={styles.donutWrap}>
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${total} open leads: ${keys.map((k) => `${counts[k]} ${DESK_STATUS_LABELS[k].toLowerCase()}`).join(", ")}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sand)" strokeWidth="14" />
        {total > 0 && keys.map((k) => {
          const len = (counts[k] / total) * c;
          const seg = <circle key={k} cx="60" cy="60" r={r} fill="none" stroke={STATUS_COLORS[k]} strokeWidth="14" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
          offset += len;
          return counts[k] > 0 ? seg : null;
        })}
        <text x="60" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--text)" fontFamily="var(--font-display)">{total}</text>
        <text x="60" y="78" textAnchor="middle" fontSize="12" fill="var(--muted)">open</text>
      </svg>
      <ul className={styles.legend}>
        {keys.map((k) => (
          <li key={k}>
            <span className={styles.dot} style={{ background: STATUS_COLORS[k] }} />
            <Link href={`/admin/leads/all?status=${k}`}>{DESK_STATUS_LABELS[k]}</Link>
            <strong>{counts[k]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusPill({ status }: { status: DeskStatus }) {
  return <span className={styles.pill} data-s={status}>{DESK_STATUS_LABELS[status]}</span>;
}
