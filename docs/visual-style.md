# Visual style guide and media library

Every picture on the site comes from one library: `src/components/visuals`. Browse all of it at
`/visuals` (not indexed, not linked). Everything is original work drawn in code, so there is nothing to license
and nothing to attribute.

## The style

- **Flat, warm, geometric.** Rounded shapes, 2px round-cap lines, generous paper space.
- **One accent.** Teal (`accent`) carries the main path or idea. Clay, sage and gold are quiet supporting colours.
  Sand panels hold side notes. No red, no alarm imagery, no clichéd gavels.
- **People are abstract and faceless.** A circle head and a rounded body (`<Person />`). We never show a realistic
  person, a stock photo or an AI-generated face, so no image implies a real client or attorney.
- **Calm for grief.** Estate settlement and executor material uses sage, fewer elements and no call-to-action energy.
- **Dark mode.** Site SVGs read colours from CSS variables (`--v-*` in `visuals.css`) with hex fallbacks, so they
  follow the site's dark mode. Static exports and share images use the light palette.
- **Accessible.** Every diagram and illustration is an `<svg role="img">` with a `<title>` and a full `<desc>` that
  explains the content in words, so screen readers and crawlers get the same information.

Palette (`tokens.ts`, matched to the site palette in docs/design-system.md): paper `#fbf8f3`, sand `#f3ebdf`, ink `#1b2a30`, muted `#56616a`, accent `#1f6670`,
accent tint `#dcecec`, clay `#c06a40`, sage `#6f957a`, gold `#e2ae45`, each with a tint.

## Using it in a page

```tsx
import { WillVsTrust, HeroTrusts, MagnetCover, VideoExplainer, Icon } from "@/components/visuals";
import { ogImageUrl } from "@/lib/og-url";

export const metadata = {
  title: "How a living trust works",
  openGraph: { images: [ogImageUrl("How a living trust works", "Trusts")] },
};

export default function Page() {
  return (
    <>
      <HeroTrusts />
      <WillVsTrust caption="Both name who inherits. They differ in how assets get there." />
      <VideoExplainer slug="how-a-revocable-living-trust-works" pagePath="/trusts/living-trust" />
      <MagnetCover slug="trust-funding-checklist" />
    </>
  );
}
```

Find visuals by topic instead of by name:

```ts
import { diagramsForTopic, illustrations, videosForTopic } from "@/components/visuals";
diagramsForTopic("probate");          // diagram entries tagged "probate"
videosForTopic("trusts");             // manifest entries tagged "trusts"
illustrations.filter((i) => i.topics.includes("wills"));
```

## What is in the library

| Kind | Where | Notes |
| --- | --- | --- |
| Diagrams (14) | `diagrams/` | IntestacyLadder, WillVsTrust, ProbateTimeline, LivingTrustFlow, PoaHealthcareRoles, PlanningProcess, BeneficiaryBeatsWill, ExecutorTrusteeAgent, TrustFundingAssets, ProbateVsTrustComparison, GuardianshipDecision, EstateTaxThresholds, SpecialNeedsTrust, BlendedFamilyPlan. Each takes `step` to reveal stages one at a time (used by the videos). |
| Hero illustrations (11) | `illustrations/heroes.tsx` | Family home, wills, trusts, probate, powers of attorney, guardianship, business succession, aging parents, blended family, special needs, estate settlement. |
| Spot illustrations (6) | `illustrations/spots.tsx` | Checklist, documents signed, video call, safe storage, questions, calendar review. |
| Lead magnet covers (8) | `covers/` | `<MagnetCover slug>` for the eight magnets in `research/lead-magnets`, or `<ResourceCover>` for a new one. |
| Icons | `icons/` | House set for drawings (`<Icon name>`). For interface icons use `lucide-react` (ISC licence), which uses the same stroke. |
| Share images | `src/lib/og.tsx`, `/og` route | 1200x630, `ogImageUrl(title, kicker?, variant?)`. Home uses `src/app/opengraph-image.tsx`. |
| Explainer videos (15) | `video/` (Remotion), `public/media/videos/` | Captioned MP4s, WebVTT captions, posters, `manifest.json`. `<VideoExplainer slug>` adds the player, chapters, transcript and VideoObject JSON-LD. Hub at `/videos`, one page per video at `/videos/[slug]`, video sitemap at `/videos/sitemap.xml`. |

## Visuals on articles and share images, automatically

- Any page rendered through `ArticlePage` (guides, comparisons, blog, life events) shows its diagram and video
  from `PAGE_MEDIA` in `src/components/visuals/PageMedia.tsx`. Add a row there to put a visual on a page.
- Every route has an `opengraph-image.tsx` that draws a share image from the page's title in `allPages()`
  (`src/lib/page-og.tsx`). A new route only needs a copy of a sibling's `opengraph-image.tsx`.
- The four interactive explainers that share a topic with a rendered video embed it (`explainerMap.ts`).

## Static files (email, PDFs, social)

`npm run visuals:export` writes standalone SVG, PNG and WebP files to `public/media/covers/` and
`public/media/illustrations/`. Use these where React can't render: email templates, the lead magnet PDFs,
social posts.

## Previewing a change

```bash
npx tsx scripts/visuals/preview.tsx WillVsTrust /tmp/will-vs-trust.png 1200          # light
npx tsx scripts/visuals/preview.tsx WillVsTrust /tmp/will-vs-trust-dark.png 1200 --dark
```

## Adding a visual

1. Build it from `primitives.tsx` (Person, Doc, Card, Text, TextLines, Arrow, Badge, Pill, Blob) and `<Icon>`,
   colouring with `c.<name>` from `tokens.ts`, never raw hex.
2. Wrap it in `<Figure title desc width height>` and write a `desc` that explains the picture fully in words.
3. Export it from the folder's `index.ts` and add it to that folder's registry with topics.
4. Preview it in light and dark and check that no text overflows.

## Legal review

Diagrams state the law in general terms ("in most states", "often"). Before launch the attorney should review
the wording in ProbateTimeline (the 6 to 18 month range), ProbateVsTrustComparison (ancillary probate),
PoaHealthcareRoles, ExecutorTrusteeAgent, BlendedFamilyPlan, EstateTaxThresholds (2026 figures: $15,000,000
exclusion, 40% top rate, $19,000 annual gift exclusion; re-check each January) and every video script.
