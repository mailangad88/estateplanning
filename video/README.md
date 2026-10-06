# Explainer videos (Remotion)

Short, silent, captioned explainer videos for the site. One parameterized composition (`src/Explainer.tsx`) renders every script in `src/data/scripts.json` in two aspects: 16:9 (1280x720) and 9:16 (720x1280), 30 fps. Graphics reuse the site's visual library in `../src/components/visuals/` (tokens, primitives, icons), so videos match the site. Extra glyphs the site set lacks live in `src/visual/icons.tsx`.

## Layout

- `src/data/scripts.json`: the 15 scripts (from `research/remotion-video-scripts.json`). Placeholders `{{SITE_URL}}`, `{{FIRM_SHORT_NAME}}`, `{{ATTORNEY_ADVERTISING_LABEL}}` and fact tokens such as `{{usdShort:fedExemptionIndividual}}` are resolved at build time from `src/config.json` and `src/data/videoFacts.json`. `[STATE]` was rewritten to "most states" / "your state".
- `src/config.json`: the one place for the firm name, the (placeholder) domain `familyplanlaw.com`, advertising label and upload date.
- `src/visual/specs.ts`: per-scene visual recipes (icon rows, flows, timelines, bars, calendar strips, compare cards). Add or change a scene's visual here. Templates are in `src/visual/templates.tsx`.
- `src/lib/captions.js`: builds word-level `Caption[]` (`@remotion/captions`), pages them with `createTikTokStyleCaptions`, and writes WebVTT. Timings are spread across each scene by word weight.
- Scenes are joined with `@remotion/transitions` (`TransitionSeries`, fade, slide into the CTA card). Headlines are fitted with `@remotion/layout-utils`.
- Composition ids: `v01-what-happens-if-you-die-without-a-will-16x9` and `...-9x16`.

## Preview

```bash
cd video
npm install
npm run studio          # Remotion Studio, pick a composition from the list
npx remotion still src/index.ts <id> out.png --frame=300 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

On a normal workstation Remotion downloads its own Chrome; the `--browser-executable` flag is only needed offline. For scripts, set `REMOTION_BROWSER=/path/to/chrome`.

## Render

```bash
npm run render                              # all 16:9 and 9:16, skips existing files
node scripts/render-all.mjs --force         # re-render everything
node scripts/render-all.mjs --only=13       # one video (id or slug fragment)
node scripts/render-all.mjs --no-vertical   # 16:9 only
```

Outputs go to `../public/media/videos/`: `<slug>.mp4`, `<slug>-vertical.mp4`, `<slug>-poster.jpg`, `<slug>.vtt`, `<slug>.txt`. The script also rewrites `../src/components/visuals/video/manifest.json` (run `node scripts/build-manifest.mjs` alone to refresh just captions, transcripts and the manifest). Rendering uses h264, CRF 26, 3 parallel browser tabs. React is aliased to `video/node_modules` in `scripts/webpack-override.mjs` so only one copy is bundled.

## Social templates

Data-driven stills and vertical shorts for Instagram, LinkedIn, Reels and Shorts, in `src/social/`. They read `../content/glossary.json` and `../content/faq.json` directly (relative import), so a new term or FAQ entry renders with no code change. Domain and firm name come from `src/config.json`. Text is fitted with `@remotion/layout-utils` (`fitText`, `fitTextOnNLines`, `measureText` word wrap) so it never overflows or breaks a word; answers are shortened at a sentence boundary (`shorten()` in `src/social/text.js`, about 280 characters). Shorts are silent and use `@remotion/transitions`.

| Composition id | Size | Props |
| --- | --- | --- |
| `GlossaryCard-4x5`, `GlossaryCard-1x1` | 1080x1350, 1080x1080 | `slug` |
| `FaqCard-4x5`, `FaqCard-landscape` | 1080x1350, 1200x627 | `index` (position in faq.json) |
| `Carousel-4x5` | 1080x1350 | `category` (FAQ category), `slide` (0-based), optional `slides: {heading, body}[]` to override the generated deck |
| `GlossaryShort` | 1080x1920, 30 fps, about 12-15 s | `slug` |
| `FaqShort` | 1080x1920, 30 fps, about 15-25 s (about 2.5 words per second of answer) | `index` |

`calculateMetadata` resolves the props (unknown slug or index falls back to the first entry) and sets each short's duration from the text length. Try one in Studio under the "Social" folder, or from the CLI:

```bash
npx remotion still src/index.ts GlossaryCard-4x5 out.png --props='{"slug":"probate"}'
npx remotion render src/index.ts FaqShort out.mp4 --props='{"index":12}'
```

Bulk render (bundles once; skips files that exist unless `--force`):

```bash
node scripts/render-social.mjs                          # all cards, all carousels, 10 + 10 shorts
node scripts/render-social.mjs --stills-only            # PNGs and caption files only
node scripts/render-social.mjs --videos-only --shorts=20
node scripts/render-social.mjs --glossary=10 --faq=5    # first N entries only
node scripts/render-social.mjs --glossary-slug=probate,trustee --faq-index=3,7   # exact entries (cards and shorts)
node scripts/render-social.mjs --force --out=/some/dir
```

Output goes to `/mnt/project-files/media/social/{glossary-cards,faq-cards,carousels,glossary-shorts,faq-shorts}/` by default (`--out` overrides). Every asset gets a `<name>.txt` post-copy file (hook, short caption, hashtags, link to `/glossary#<slug>` or `/faq`). The caption wording lives in `scripts/render-social.mjs` (`glossaryCopy`, `faqCopy`, `carouselCopy`); have the attorney review it before posting. Shorts use a spread of entries (`--shorts=N`).

## Update the facts every year

Edit `src/data/videoFacts.json` (`taxYear`, `fedExemptionIndividual`, `topEstateTaxRate`, `annualGiftExclusion`, `ssiResourceLimitIndividual`) each December after re-verifying the sources listed in the file, then `node scripts/render-all.mjs --force --only=5` and `--only=13` (videos 5 and 13 use the numbers; captions and transcripts update with them). Re-check the other videos' state-law statements with your legal reviewer at the same time.

## Add the attorney voiceover later

Every composition accepts an optional `audioSrc` prop. When set it plays as a Remotion `<Audio>` from `@remotion/media`; when absent the video stays silent and the captions carry the narration. To use it:

1. Put the recording in `video/public/` (for example `public/voice/v01.mp3`).
2. Studio: set the prop in the props panel to `staticFile("voice/v01.mp3")`, or in `src/Root.tsx` add `audioSrc: staticFile("voice/v01.mp3")` to that video's `defaultProps`.
3. Re-render. If the read runs longer or shorter than a scene, adjust that scene's `durationSec` and later `startSec` values in `scripts.json` (and the total `durationSec`); captions follow automatically. Caption timing is estimated by word count today, so for exact sync generate word timestamps from the recording (Whisper via `@remotion/captions`, see Remotion's transcribe-captions docs) and feed them to `buildCaptions`.
4. If the voice is synthetic, disclose it in the description and transcript page.

## License note

Remotion is free for individuals and for companies of up to 3 employees. Larger companies need a company license from https://remotion.pro. Check which applies to the firm before using this project commercially. The rest of this project (our scenes, scripts and tooling) belongs to the site.
