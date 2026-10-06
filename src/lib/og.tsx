import { ImageResponse } from "next/og";
import { firm } from "@/config/firm";
import { hex } from "@/components/visuals/tokens";

export { ogImageUrl } from "./og-url";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export type OgVariant = "accent" | "sage" | "clay" | "gold";

const palettes: Record<OgVariant, { main: string; tint: string; deep: string; ink: string }> = {
  accent: { main: hex.accent, tint: hex.accentTint, deep: hex.accentDeep, ink: hex.accentDeep },
  sage: { main: hex.sage, tint: hex.sageTint, deep: hex.ink, ink: hex.ink },
  clay: { main: hex.clay, tint: hex.clayTint, deep: hex.ink, ink: hex.ink },
  gold: { main: hex.gold, tint: hex.goldTint, deep: hex.ink, ink: hex.ink },
};

/** Decorative motif: a house with a shield, over soft discs. Plain SVG, no CSS variables. */
function Motif({ p }: { p: (typeof palettes)[OgVariant] }) {
  return (
    <svg width="380" height="380" viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg">
      <circle cx="190" cy="190" r="180" fill={p.tint} />
      <circle cx="190" cy="190" r="128" fill={hex.surface} opacity="0.7" />
      <path d="M 90 200 L 190 112 L 290 200 V 296 a 12 12 0 0 1 -12 12 H 102 a 12 12 0 0 1 -12 -12 Z" fill={hex.surface} stroke={hex.line} strokeWidth="3" />
      <path d="M 70 208 L 190 100 L 310 208" fill="none" stroke={p.main} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="166" y="236" width="48" height="72" rx="24" fill={hex.clay} />
      <rect x="166" y="260" width="48" height="48" fill={hex.clay} />
      <path d="M 290 232 L 244 250 V 290 C 244 322 266 340 290 350 C 314 340 336 322 336 290 V 250 Z" fill={hex.accent} stroke={hex.accent} strokeWidth="6" strokeLinejoin="round" />
      <path d="M 270 292 L 285 307 L 312 274" fill="none" stroke={hex.surface} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function titleSize(len: number) {
  if (len <= 28) return 84;
  if (len <= 48) return 70;
  if (len <= 72) return 58;
  return 48;
}

/** Render a 1200x630 share image in the house style. */
export function renderOgImage({ title, kicker, variant = "accent" }: { title: string; kicker?: string; variant?: OgVariant }) {
  const p = palettes[variant] ?? palettes.accent;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: hex.paper,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", height: 14, width: "100%", backgroundColor: p.main }} />
        <div style={{ display: "flex", flex: 1, padding: "52px 72px 48px 72px" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: 24 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, backgroundColor: p.main, marginRight: 14 }} />
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: hex.ink, letterSpacing: -0.5 }}>{firm.brandName}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {kicker ? (
                <div
                  style={{
                    display: "flex",
                    alignSelf: "flex-start",
                    padding: "8px 20px",
                    borderRadius: 999,
                    backgroundColor: p.tint,
                    color: p.ink,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 28,
                  }}
                >
                  {kicker}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  fontSize: titleSize(title.length),
                  fontWeight: 700,
                  color: hex.ink,
                  lineHeight: 1.1,
                  letterSpacing: -1.5,
                  maxWidth: 700,
                }}
              >
                {title}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 24, color: hex.muted }}>Estate planning with a real attorney</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 380 }}>
            <Motif p={p} />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
