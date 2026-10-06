import type { ReactNode } from "react";
import { iconPaths } from "../../../src/components/visuals/icons/paths";
import { c, type ColorName } from "../../../src/components/visuals/tokens";

type Draw = (t: string) => ReactNode;

/** Glyphs the site set does not (yet) have, drawn in the same 24px, 2px-line style. */
const extras: Record<string, Draw> = {
  "trust-box": (t) => (<><rect x="3" y="9" width="18" height="11" rx="2" fill={t} /><path d="M3 12h18M5 9l1.5-4h11L19 9" /><circle cx="12" cy="16" r="1.4" /></>),
  "open-book": (t) => (<><path d="M12 6C10 4.5 7 4 4 4.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6z" fill={t} /><path d="M12 6v13" /></>),
  "closed-book": (t) => (<><path d="M6 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill={t} /><path d="M8 4v16M11 9h5" /></>),
  plane: (t) => (<><path d="M3 13L21 5l-6 15-3-6-9-1z" fill={t} /><path d="M12 14l3-4" /></>),
  music: (t) => (<><path d="M9 18V6l10-2v12" /><circle cx="7" cy="18" r="2.5" fill={t} /><circle cx="17" cy="16" r="2.5" fill={t} /></>),
  paw: (t) => (<><ellipse cx="12" cy="16" rx="4.5" ry="3.5" fill={t} /><circle cx="5.5" cy="11" r="1.7" fill={t} /><circle cx="9.5" cy="7" r="1.7" fill={t} /><circle cx="14.5" cy="7" r="1.7" fill={t} /><circle cx="18.5" cy="11" r="1.7" fill={t} /></>),
  gift: (t) => (<><rect x="3" y="7" width="18" height="4" rx="1" fill={t} /><rect x="4" y="11" width="16" height="9" rx="1.5" fill={t} /><path d="M12 7v13M12 7c-1-3.5-5-3-5-1.2S10.5 7 12 7zM12 7c1-3.5 5-3 5-1.2S13.5 7 12 7z" /></>),
  coins: (t) => (<><ellipse cx="9" cy="7.5" rx="6" ry="2.5" fill={t} /><path d="M3 7.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4M3 11.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" /><path d="M15 11c3 0 6 .8 6 2.2v4.3c0 1.4-2.7 2.5-6 2.5" /></>),
  chart: (t) => (<><path d="M4 4v16h16" /><rect x="7" y="12" width="3" height="6" fill={t} /><rect x="12" y="8" width="3" height="10" fill={t} /><rect x="17" y="5" width="2.5" height="13" fill={t} /></>),
  newspaper: (t) => (<><rect x="3" y="5" width="18" height="14" rx="2" fill={t} /><path d="M7 9h4M7 12h10M7 15h10" /></>),
  notebook: (t) => (<><rect x="5" y="3" width="14" height="18" rx="2" fill={t} /><path d="M9 3v18M12 8h4M12 12h4" /></>),
  certificate: (t) => (<><rect x="3" y="4" width="18" height="12" rx="2" fill={t} /><path d="M7 8h10M7 11h6" /><circle cx="17" cy="17" r="2.5" fill={t} /><path d="M16 19.5l-1 2.5 2-1 2 1-1-2.5" /></>),
  stack: (t) => (<><rect x="8" y="3" width="12" height="15" rx="2" /><rect x="4" y="6" width="12" height="15" rx="2" fill={t} /><path d="M7 11h6M7 14h4" /></>),
  pause: (t) => (<><circle cx="12" cy="12" r="9" fill={t} /><path d="M10 9v6M14 9v6" /></>),
  light: (t) => (<path d="M9 17h6M10 20h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill={t} />),
  furniture: (t) => (<><rect x="6" y="8" width="12" height="6" rx="2" fill={t} /><path d="M3 12v6h18v-6M6 18v2M18 18v2" /></>),
  ring: (t) => (<><circle cx="12" cy="15" r="5" /><path d="M9 6l3-3 3 3-3 3z" fill={t} /></>),
  slider: (t) => (<><rect x="3" y="9" width="18" height="6" rx="3" fill={t} /><circle cx="16" cy="12" r="2.5" fill={t} /></>),
  "medicare-card": (t) => (<><rect x="3" y="5" width="18" height="14" rx="2" fill={t} /><path d="M7 11h6M7 15h4M17 9v4M15 11h4" /></>),
  "medicaid-card": (t) => (<><rect x="3" y="5" width="18" height="14" rx="2" fill={t} /><path d="M7 11h6M7 15h4M15 15l1.5 1.5L19 13" /></>),
  bill: (t) => (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" fill={t} /><path d="M9 8h6M9 12h6" /></>),
  stamp: (t) => (<><path d="M9 13V9a3 3 0 1 1 6 0v4" fill={t} /><rect x="5" y="13" width="14" height="4" rx="1" fill={t} /><path d="M4 21h16" /></>),
  "tax-form": (t) => (<><path d="M6 3h9l4 4v14H6z" fill={t} /><path d="M9 17l6-6" /><circle cx="9.5" cy="12" r=".8" /><circle cx="14.5" cy="16.5" r=".8" /></>),
  form: (t) => (<><rect x="5" y="3" width="14" height="18" rx="2" fill={t} /><path d="M8 8h1M11 8h5M8 12h1M11 12h5M8 16h1M11 16h4" /></>),
  checklist: (t) => (<><rect x="4" y="3" width="16" height="18" rx="2" fill={t} /><path d="M7.5 8l1.2 1.2L11 7M7.5 13l1.2 1.2L11 12M13 8.5h4M13 13.5h4" /></>),
  cash: (t) => (<><rect x="3" y="7" width="18" height="10" rx="2" fill={t} /><circle cx="12" cy="12" r="2.5" /></>),
  meter: () => (<><path d="M4 17a8 8 0 0 1 16 0" /><path d="M12 17l4-5" /></>),
  percent: (t) => (<><path d="M18 6L6 18" /><circle cx="7.5" cy="7.5" r="2.5" fill={t} /><circle cx="16.5" cy="16.5" r="2.5" fill={t} /></>),
  "map-outline": (t) => (<><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" fill={t} /><path d="M9 4v14M15 6v14" /></>),
  branches: () => (<path d="M12 20v-6M12 14L6 8M12 14l6-6M12 14V5" />),
  timeline: (t) => (<><path d="M3 12h18" /><circle cx="6" cy="12" r="2" fill={t} /><circle cx="12" cy="12" r="2" fill={t} /><circle cx="18" cy="12" r="2" fill={t} /></>),
  valve: (t) => (<><path d="M4 14h16M12 14V8" /><rect x="8" y="5" width="8" height="3" rx="1" fill={t} /><circle cx="12" cy="14" r="3" fill={t} /></>),
  tag: (t) => (<><path d="M3 12V4h8l10 10-8 8z" fill={t} /><circle cx="7.5" cy="8.5" r="1.2" /></>),
  card: (t) => (<><rect x="3" y="5" width="18" height="14" rx="2" fill={t} /><path d="M3 10h18" /></>),
};

/** Names that exist nowhere map to the closest drawn glyph. */
const alias: Record<string, string> = {
  parent: "person", successor: "person", trustee: "briefcase", spouse: "partner", children: "family",
  relatives: "family", beneficiaries: "family", petition: "document", deed: "document", letter: "envelope",
  mail: "envelope", mailbox: "envelope", insurance: "life-insurance", medical: "heart", therapy: "heart",
  tree: "family-tree", payout: "coins", brokerage: "chart", speech: "chat", hands: "hand-heart",
  handshake: "hand-heart", arrows: "arrow-right", arrow: "arrow-right", window: "calendar", "progress-bar": "hourglass",
  bar: "chart", bars: "chart", slice: "percent", gate: "lock", circle: "heart", book: "open-book",
};

export function SIcon({
  name, x = 0, y = 0, size = 48, color = "accent", tint = "accentTint", strokeWidth = 2,
}: { name: string; x?: number; y?: number; size?: number; color?: ColorName; tint?: ColorName | "none"; strokeWidth?: number }) {
  const fill = tint === "none" ? "none" : c[tint];
  const draw: Draw =
    iconPaths[name] ?? extras[name] ?? iconPaths[alias[name]] ?? extras[alias[name]] ?? iconPaths["question-mark"];
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`}>
      <g style={{ stroke: c[color], color: c[color] }} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {draw(fill)}
      </g>
    </g>
  );
}
