# Staging on Vercel

Staging is a separate Vercel project that builds `main` with `SITE_ENV=staging`.

What staging does:
- Builds even with unfilled firm placeholders (production stays blocked by `scripts/launch-check.mjs`).
- Adds `noindex, nofollow` to every page (meta tag and `X-Robots-Tag` header) and serves a robots.txt that disallows all crawlers.
- Shows a "Staging preview" banner.
- Does not forward form submissions to `CRM_WEBHOOK_URL` unless `STAGING_ALLOW_CRM=true`.

Set up (once):
1. vercel.com/new, import `mailangad88/estateplanning`. Framework preset: Next.js (from `vercel.json`). Production branch: `main`.
2. Environment variables (Production and Preview):
   - `SITE_ENV=staging`
   - `SERVED_STATES=TX` (or the launch state) so the plan finder booking path can be tested; leave unset to see the out-of-state flow.
   - `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`
3. Deploy. Use only the `*.vercel.app` address; do not add a custom domain to the staging project.

The lawyer portal (`/portal`) needs Postgres and secrets (`DATABASE_URL`, `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `EMAIL_TRANSPORT`) and returns an error on staging until they are set.

Going live later is a different project (or removing `SITE_ENV`) with every placeholder filled; `LAUNCH_CHECK=strict npm run launch-check` lists what is left.
