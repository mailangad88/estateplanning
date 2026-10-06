/**
 * Visual tokens for every illustration, diagram, cover, OG image and video.
 *
 * Style in one line: flat, warm, geometric, rounded 2px lines, generous paper
 * space, one teal accent with clay and sage as quiet supporting colours.
 * People are abstract and faceless (a circle head and a rounded body) so no
 * image ever pretends to be a real client or attorney.
 *
 * `hex` is the literal palette, for places that cannot read CSS variables
 * (OG images, static SVG exports). `c` wraps each colour in a CSS variable
 * with the hex as fallback, so inline SVG follows the site's dark mode when
 * visuals.css is loaded and still renders correctly without it.
 */
export const hex = {
  paper: "#fbf8f3",
  surface: "#ffffff",
  sand: "#f3ebdf",
  sandDeep: "#e6d7c0",
  ink: "#1b2a30",
  muted: "#56616a",
  line: "#e3dcd0",
  accent: "#1f6670",
  accentDeep: "#17505b",
  accentTint: "#dcecec",
  clay: "#c06a40",
  clayTint: "#f7e6da",
  sage: "#6f957a",
  sageTint: "#e4eee6",
  gold: "#e2ae45",
  goldTint: "#f8edd2",
} as const;

export type ColorName = keyof typeof hex;

export const hexDark: Record<ColorName, string> = {
  paper: "#121a1c",
  surface: "#1a2427",
  sand: "#262420",
  sandDeep: "#3a342b",
  ink: "#ece8e1",
  muted: "#a9b3b6",
  line: "#33403f",
  accent: "#7fc4c9",
  accentDeep: "#a8dade",
  accentTint: "#1a3639",
  clay: "#e3946a",
  clayTint: "#3d2a1f",
  sage: "#93bb9e",
  sageTint: "#22332a",
  gold: "#e6bf66",
  goldTint: "#3a3121",
};

const cssVar = (name: string) => `--v-${name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`;

/** CSS-variable colour references with literal fallbacks. Use in `style`, not presentation attributes. */
export const c = Object.fromEntries(
  (Object.keys(hex) as ColorName[]).map((k) => [k, `var(${cssVar(k)}, ${hex[k]})`]),
) as Record<ColorName, string>;

/** CSS text declaring every variable for light and dark. visuals.css mirrors this. */
export function visualsCss(): string {
  const decl = (p: Record<string, string>) =>
    Object.entries(p).map(([k, v]) => `${cssVar(k)}: ${v};`).join(" ");
  return `:root { ${decl(hex)} }\n@media (prefers-color-scheme: dark) { :root { ${decl(hexDark)} } }`;
}

export const stroke = { thin: 1.5, base: 2, bold: 3 } as const;
export const radius = { sm: 6, md: 12, lg: 20 } as const;
export const font = {
  family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  heading: 600,
  body: 400,
} as const;

/** Shared line props for drawn shapes. */
export const lineProps = {
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
