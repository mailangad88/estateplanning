# Social video studio

Admin area at `/admin/studio`, behind the portal sign-in and its 2FA. It researches, writes, checks, previews and schedules videos for YouTube (long videos and Shorts) and Instagram Reels. The plan and cost comparison are in `research/social-video-studio-plan.md` in the project files.

## Pipeline

1. **Topic**: `src/server/studio/topics.ts` takes the next unused question from `content/questions.json`, Illinois first. It skips questions about other states' law, and a question is used once per format.
2. **Research and script**: `writer.ts`.
   - `SiteDraftWriter` is the default and costs nothing. It builds the script from the site page that answers the question, so it only handles answered questions.
   - `ClaudeWriter` runs when `STUDIO_WRITER=anthropic` and `ANTHROPIC_API_KEY` are set. It researches with web search, writes the storyline and script, then runs a separate editor and fact-check pass. Every factual beat cites a source id.
3. **Checks**: `quality.ts` runs these checks:
   - banned advertising words (the same list as `scripts/launch-check.mjs`, kept in `wordlists.ts`)
   - filler phrases
   - advice aimed at one person's own case
   - length (Shorts must run 58 seconds or less)
   - every claim has a source
   - fictional examples are labelled
   - the script ends on a call to action
   - the disclaimer is present

   A failed blocking check sets the video to `needs_rewrite`.
4. **Director**: `director.ts` maps beats to scenes for the Remotion templates in `src/studio/video`. It is deterministic, so the approval hash covers exactly what renders.
5. **Attorney review**: the review is tied to `contentHash(script + plan)`. Any edit clears the approval. Only an `attorney` approval counts. A platform admin's approval is recorded but does not count.
6. **Render**: runs only after approval. The `Studio` GitHub Actions workflow takes jobs from `/api/studio/render-queue`, renders with `video/scripts/render-studio.mjs`, uploads the files to S3-compatible storage (R2), and reports to `/api/studio/render-result`.
7. **Schedule**: `schedule.ts` fills slots, on the hour in Chicago time. Defaults are 2 long videos and 6 shorts a day. A platform admin can edit them at `/admin/studio/schedule`.
8. **Publish**: `publish.ts` runs from `/api/cron/studio`.
   - `STUDIO_PUBLISH_MODE=off` (the default) logs what would post.
   - `private` uploads to YouTube as private and skips Instagram.
   - `live` posts publicly.

## Storage

The studio's tables are in `db/studio.sql` (JSON documents, service role only). Apply them after `db/schema.sql`. Without `DATABASE_URL`, an in-memory store is used for development.

## Roles

| Action | Roles |
|---|---|
| See the studio | platform_admin, marketing, attorney, firm_admin |
| Draft, edit, rewrite, unschedule | platform_admin, marketing |
| Approve, send back, reject | attorney (counts), platform_admin (recorded only) |
| Connect channels, change publish times | platform_admin |

All of these need the 2FA session in production.

## Turning things on (each step needs Angad's OK)

1. Apply `db/studio.sql`. Set `STUDIO_TOKEN_KEY` and `STUDIO_WORKER_TOKEN`.
2. YouTube:
   - Set up a Google Cloud OAuth client and set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.
   - Click Connect at `/admin/studio/channels`.
   - Request the YouTube API audit. Until it passes, uploads stay private.
3. Instagram:
   - Use a Professional account and a Meta app with the Instagram API (Instagram login).
   - Set `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`, then click Connect.
4. Storage: create an R2 bucket with a public URL and set the `STUDIO_S3_*` and `STUDIO_MEDIA_BASE_URL` repository secrets.
5. Set the repository secrets `STUDIO_SITE_URL` and `CRON_SECRET` so the hourly workflow runs.
6. Test with `STUDIO_PUBLISH_MODE=private`, then switch to `live`.

The upload calls follow the public API docs but have not been run against live accounts yet.
