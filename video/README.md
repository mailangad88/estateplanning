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
