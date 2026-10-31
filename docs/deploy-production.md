# Going live on familyfutureplanning.com

The domain is registered at Squarespace, DNS moves to Cloudflare (free plan), and the site runs on Vercel.
Staging stays exactly as it is: `estateplanning-staging.vercel.app`, `SITE_ENV=staging`, Vercel Authentication on, no custom domain.

Canonical address: **https://familyfutureplanning.com** (apex). `www` redirects to it.

The code already uses this domain when `NEXT_PUBLIC_SITE_URL` is unset (`src/config/site.ts`), so canonical tags, the sitemap,
robots.txt, llms.txt, Open Graph images and JSON-LD all point at the live domain. Staging overrides it with its own address.
The live project's `*.vercel.app` address is served with `X-Robots-Tag: noindex` so only the custom domain gets indexed (`next.config.ts`).

There are two parts. Part 1 is safe to do now (nothing public changes except the Squarespace parking page disappearing).
Part 2 makes the site live and waits for the go-ahead and for `LAUNCH_CHECK=strict npm run launch-check` to pass.

## Part 1. Move DNS to Cloudflare (safe now)

1. **Cloudflare:** dash.cloudflare.com → *Add a domain* → `familyfutureplanning.com` → *Quick scan for DNS records* → plan **Free**.
2. **Clean up the imported records.** Cloudflare copies what Squarespace had. Delete the four `A @` records to `198.185.159.144/145` and `198.49.23.144/145`,
   the `CNAME www → ext-cust.squarespace.com` record, and any `_domainconnect` record. Keep MX/TXT records only if you already use email on this domain.
3. **Add the Vercel records,** both with the proxy **off** (grey cloud, "DNS only"). Vercel issues and renews the certificate itself, and a proxied record breaks that.

   | Type  | Name  | Content                 | Proxy    |
   |-------|-------|-------------------------|----------|
   | A     | `@`   | `76.76.21.21`           | DNS only |
   | CNAME | `www` | `cname.vercel-dns.com`  | DNS only |

4. **SSL/TLS → Overview → Full (strict).** It does nothing while the records are DNS only, but it is the only safe setting if someone turns the orange cloud on later.
5. **Squarespace:** account.squarespace.com → *Domains* → `familyfutureplanning.com` → *DNS* → *Domain Nameservers* → *Use custom nameservers*.
   If DNSSEC is on, turn it off first. Enter the two nameservers Cloudflare shows (they look like `name.ns.cloudflare.com`) and remove the Squarespace ones.
6. Wait for Cloudflare's "your domain is now active" email (minutes to a few hours). Then, optionally, turn on DNSSEC in Cloudflare and paste its DS record into Squarespace.

Until Part 2, the domain points at Vercel but no project claims it, so it shows a Vercel 404. That is expected.

## Part 2. Make the site live on Vercel (needs Angad's go-ahead)

Before this: every placeholder filled and IL and NJ marked `verified: true` in `src/config/compliance.ts`.
`LAUNCH_CHECK=strict npm run launch-check` must pass, or the production build stops on purpose.

**Vercel plan.** Vercel's free Hobby plan is for personal, non-commercial use. A referral site that generates leads is commercial, so the live project needs Pro
($20/month per seat) or a move to a free host such as Cloudflare Workers. Staging can stay on Hobby. This is Angad's call.

1. vercel.com/new → import `mailangad88/estateplanning` → project name `familyfutureplanning`. Framework: Next.js (from `vercel.json`). Production branch: `main`.
2. **Environment variables (Production):**
   - `NEXT_PUBLIC_SITE_URL=https://familyfutureplanning.com`
   - `APP_URL=https://familyfutureplanning.com` (sign-in links, invites, alert emails)
   - `SERVED_STATES=IL,NJ`
   - no `SITE_ENV` (that would make it staging)
   - the portal and email secrets from `.env.example` (`SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `FAMILY_PLAN_KEY`, `DATABASE_URL`, `CRON_SECRET`, `EMAIL_TRANSPORT`, `RESEND_API_KEY`, `EMAIL_FROM`)
   - `OUTBOUND_SEND_MODE=log` until the attorney approves the templates
3. **Settings → Domains:** add `familyfutureplanning.com`. Add `www.familyfutureplanning.com` and set it to *Redirect to* `familyfutureplanning.com` (308).
   Both should turn green within a few minutes because the Cloudflare records from Part 1 are already in place.
4. **Settings → Deployment Protection:** leave *Standard Protection* (preview URLs need a Vercel login, the custom domain is public).
5. Deploy, then check `https://familyfutureplanning.com/robots.txt`, `/sitemap.xml` and `/llms.txt` show the live domain, and that `https://www.familyfutureplanning.com` redirects.
6. Submit `https://familyfutureplanning.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools (verify with a DNS TXT record in Cloudflare).

Every push to `main` then deploys both projects: staging (noindexed, protected) and live.

## Email: sending and receiving (free)

**Sending (Resend, free up to 3,000 emails a month).** resend.com → *Domains* → add `familyfutureplanning.com`. Resend lists the exact records; they look like this.
Add each in Cloudflare as DNS only, then press *Verify* in Resend.

| Type | Name                 | Content                                            |
|------|----------------------|----------------------------------------------------|
| MX   | `send`               | `feedback-smtp.us-east-1.amazonses.com` (priority 10) |
| TXT  | `send`               | `v=spf1 include:amazonses.com ~all`                |
| TXT  | `resend._domainkey`  | the DKIM key Resend shows (`p=MIGf...`)            |
| TXT  | `_dmarc`             | `v=DMARC1; p=none; adkim=s; aspf=r`                |

Start DMARC at `p=none`. After a few weeks of clean sending, change it to `p=quarantine`. Cloudflare's free *Email → DMARC Management* adds a reporting address and shows who sends as the domain.

Then set `EMAIL_FROM="Family Future Planning <hello@familyfutureplanning.com>"` on the live project.

**Receiving (Cloudflare Email Routing, free).** Cloudflare → *Email → Email Routing* → enable, and forward `hello@` (and `dmarc@` if used) to a personal inbox.
Cloudflare adds its own MX and SPF records at `@`. They do not clash with Resend's, which live on `send`.

## Rolling back

- Domain off the site: remove it under the live project's *Settings → Domains*. Nothing else changes.
- DNS back to Squarespace: switch the nameservers in Squarespace back to *Use Squarespace nameservers*.
