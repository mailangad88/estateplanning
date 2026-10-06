# Design system

The site's look lives in three places:

- `src/app/design.css`: colour and type tokens, buttons, header and mega menu, full-width bands, hero, cards,
  step track, pricing tiers, life-stage pages and footer. It loads after `globals.css`, so the tokens restyle every
  older page too.
- `src/components/landing.tsx`: the building blocks for designed pages (`Band`, `SectionHead`, `FeatureCard`,
  `StageGrid`, `Steps`, `TrustRow`, `StageArt`). A `Band` breaks out of the 780px reading column to full width.
- `src/config/navigation.ts` and `src/config/life-stages.ts`: the mega menu and the seven life-stage landing pages.

## Palette

| Token | Light | Use | Contrast |
| --- | --- | --- | --- |
| `--brand` | `#17505b` deep teal | links, headings accents, brand | 8.5:1 on cream |
| `--brand-deep` | `#0e3940` | dark bands, footer | cream text 11.8:1 |
| `--cta` | `#a9502c` terracotta | primary buttons | white text 5.4:1 |
| `--bg` / `--sand` | `#fbf8f3` / `#f3ebdf` | page and panels | body text 14:1 |
| `--muted` | `#56616a` | secondary text | 6.0:1 on cream, 5.4:1 on sand |
| `--sage` | `#5e8a6c` | calm accent, grief pages | decorative only; text uses `--sage-deep` |
| `--gold` | `#e2ae45` | highlights on dark bands | 6.2:1 on deep teal |

The illustration palette in `src/components/visuals/tokens.ts` uses the same teal, so the art matches. Dark mode
redefines every token under `prefers-color-scheme: dark`.

Type: Fraunces (headings, self-hosted via `@fontsource-variable/fraunces`) and Inter (body). Base size stays 18px.

## Life-stage pages

Each entry in `LIFE_STAGES` points at an audience page in `content/audiences` and adds the hero message, the three
priorities, the illustration, the call to action and a free resource. `senior: true` (retirees 65+) switches to larger
type, one main choice and the phone number first. Copy in the config is advertising copy: the launch-check word rules
apply, and claims must stay true.

To add a stage: write the audience markdown, add a `LIFE_STAGES` entry, and pick an illustration (or add one in
`src/components/visuals/illustrations/stages.tsx`). The nav, footer, homepage grid and hub pick it up automatically.
