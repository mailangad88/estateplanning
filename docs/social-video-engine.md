# Social video engine: Blender shorts, Seedance b-roll, /tips magnet pages

Status: draft, built 2026-10-31. Nothing here posts anywhere or spends money. Every script and page waits for
the attorney's review.

## The loop

1. **Calendar** (`content/social/calendar.json`): 30 short scripts, one a day. Each one names the worry it
   answers (pillar: fear, money, tip, FAQ, myth, checklist), the voiceover, the on-screen scenes, the caption,
   and the `/tips` page it sends people to.
2. **Blender render** (`blender/render_short.py`): turns a calendar entry into a 1080x1920 MP4 with the site's
   palette, animated text cards, a progress bar, the disclaimer on every frame and an end card with the URL.
3. **Optional Seedance 2.0 b-roll** (Higgsfield): a 5-second shot of a place or object (a porch, a kitchen
   table) dropped in as a `broll` scene. Objects and places only, and the clip is tagged "AI-generated footage".
4. **Magnet page** (`/tips/<slug>`): the full answer, a tap-through quick check, Illinois facts with citations,
   steps for this week, the free guide, an interactive tool, and "Book a consult".
5. **Tracking**: every caption link carries `utm_source` (instagram, facebook, youtube), `utm_medium=social-video`,
   `utm_campaign=tips-il-launch` and `utm_content=<video id>`. The site's session attribution keeps those for any
   form, and the booking button sends `/book?from=ig-<slug>` (or fb-, yt-) so bookings show the platform.

## Blender setup (free)

Pick one:

- **Python module, no install needed**: `pip install bpy==5.2.3` (needs Python 3.13, about 400 MB). This is what
  the cloud sessions use.
- **Blender app**: install Blender 5.x from blender.org, then run `blender -b -P blender/render_short.py -- <args>`.

`ffmpeg` on PATH is recommended (smaller files and voiceover muxing). Without it, Blender's own encoder is used.

```bash
# one frame, to check the layout (seconds)
npm run blender:render -- --spec content/social/calendar.json --id v01 --out out/v01.png --preview 60
# draft at half size
npm run blender:render -- --spec content/social/calendar.json --id v01 --out out/v01.mp4 --scale 50
# final, with a recorded voiceover
npm run blender:render -- --spec content/social/calendar.json --id v01 --out out/v01.mp4 --audio vo/v01.m4a
```

Rendering is CPU-only (Cycles, one sample, flat emission materials), so it works on any laptop or CI runner. A 42-second short took about 9 minutes on 4 CPU cores and came out at 1.5 MB.

Scene types: `hook`, `point`, `stat`, `steps`, `myth`, `broll` (needs `video`), `end` (needs `url`). Fonts: Inter
if installed, otherwise a system sans, otherwise Blender's built-in font; override with `--font`.

## Seedance 2.0 through Higgsfield

What it adds: short, realistic shots that text cards cannot (a house at dusk, a kitchen table with papers). Use it
for the first two to three seconds behind the hook, at most one shot per video.

Cost (third-party figures, October 2026; check the live pricing page before buying):

| Route | What you pay | What it buys |
|---|---|---|
| Higgsfield app plan | roughly $99 to $129 a month for about 3,000 credits | Seedance 2.0 is about 22 credits per 5-second 720p clip, about 60 at 1080p: roughly 130 or 50 clips |
| Higgsfield API | prepaid dollar balance, billed per second, separate from app plans | third-party comparisons put a 5-second 720p clip at about $1.20 to $1.50 |
| Our plan for month one | about 10 shots a month | about $12 to $15 on a prepaid API balance, or the cheapest plan that includes Seedance 2.0 |

Lowest-cost recommendation: launch with Blender only (free). After the attorney approves the first batch, try one
month of Seedance with a small prepaid balance and compare watch time on videos with and without b-roll.

What Angad has to do (nothing is set up yet):

1. Create the Higgsfield account and choose the plan or prepaid API balance.
2. Save the key as an environment secret named `HIGGSFIELD_API_KEY` (Vercel or the cloud environment settings).
   Never paste it into chat.
3. Allow `higgsfield.ai` and its API host in the cloud environment's network settings; this session could not
   reach it.

Until the key exists, prompts live in each calendar entry's `seedance` field. Generate the clip in the Higgsfield
app, save it as `out/broll/<id>.mp4`, and add a scene `{ "type": "broll", "video": "out/broll/<id>.mp4", "seconds": 3 }`
at the start of that video.

Rules for AI footage: no people's faces presented as real, never the attorney's likeness, no fake clients. Turn on
the platform's AI label when it asks (YouTube's "altered or synthetic content" setting, Meta's AI info label).

## /tips pages

- Data: `src/config/social-tips.ts` (12 Illinois pages). Hub at `/tips` is the link-in-bio page.
- `reviewed: false` keeps each page `noindex`. Flip it only with the attorney's sign-off.
- Dementia and Medicaid pages are listed in `src/config/sensitive.ts`, so ad pixels and detailed analytics stay off.
- Offers stay neutral ("Book a consult"). No free-call, response-time or outcome promises; `tests/socialTips.test.ts`
  fails if one slips in.

## Review sheet

`npm run social:calendar -- --start 2026-11-09` writes `exports/social/calendar.md` (for the attorney's review) and
`calendar.csv` (one row per platform with tagged links, ready for a scheduler).

Posting stays off. The existing studio (`docs/social-studio.md`, `/admin/studio`) handles uploads once Angad turns on
`STUDIO_PUBLISH_MODE` with a typed go-ahead.
