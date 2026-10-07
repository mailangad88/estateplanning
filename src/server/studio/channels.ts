/**
 * YouTube and Instagram connections: OAuth sign-in, token storage and the upload calls.
 *
 * Tokens are sealed with AES-256-GCM (STUDIO_TOKEN_KEY) before they are stored and never
 * reach the browser. The upload calls follow the public API docs (YouTube Data API v3
 * resumable upload; Instagram API with Instagram Login, Reels container then publish) but
 * have not been run against live accounts yet: test with STUDIO_PUBLISH_MODE=private first.
 */
import { createHash } from "node:crypto";
import { site } from "@/config/site";
import { aesGcmDecrypt, aesGcmEncrypt } from "@/server/auth/identity";
import type { ChannelAccount, Platform } from "./types";

type Fetch = typeof fetch;

/* ---------- token sealing ---------- */

function tokenKey(): Buffer {
  const k = process.env.STUDIO_TOKEN_KEY;
  if (k && k.length >= 32) return createHash("sha256").update(k).digest();
  if (process.env.NODE_ENV === "production") throw new Error("STUDIO_TOKEN_KEY must be set (32+ characters) before connecting channels");
  return createHash("sha256").update("development-only-studio-token-key").digest();
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string; // ISO
}

export function sealTokens(platform: Platform, t: Tokens): string {
  return aesGcmEncrypt(tokenKey(), JSON.stringify(t), `studio:${platform}`);
}

export function openTokens(platform: Platform, sealed: string): Tokens {
  return JSON.parse(aesGcmDecrypt(tokenKey(), sealed, `studio:${platform}`)) as Tokens;
}

/* ---------- OAuth ---------- */

export function redirectUri(platform: Platform): string {
  return `${site.url}/api/admin/studio/channels/${platform}/callback`;
}

export function oauthConfigured(platform: Platform, env: NodeJS.ProcessEnv = process.env): boolean {
  return platform === "youtube" ? Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) : Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET);
}

const IG_VERSION = () => process.env.INSTAGRAM_GRAPH_VERSION ?? "v23.0";

export function authorizeUrl(platform: Platform, state: string, env: NodeJS.ProcessEnv = process.env): string {
  if (platform === "youtube") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", env.YOUTUBE_CLIENT_ID ?? "");
    u.searchParams.set("redirect_uri", redirectUri("youtube"));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", state);
    return u.toString();
  }
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", env.INSTAGRAM_APP_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri("instagram"));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
  u.searchParams.set("state", state);
  return u.toString();
}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = body.error as { message?: string } | string | undefined;
    throw new Error(`${what} failed (${res.status}): ${typeof err === "string" ? err : err?.message ?? body.error_description ?? "no detail"}`);
  }
  return body;
}

const inSeconds = (s: unknown, now: Date) => new Date(now.getTime() + Number(s ?? 3600) * 1000).toISOString();

/** Exchanges the OAuth code and reads the account name. Returns the channel record to store. */
export async function connect(platform: Platform, code: string, by: string, f: Fetch = fetch, now = new Date()): Promise<ChannelAccount> {
  const env = process.env;
  if (platform === "youtube") {
    const tok = await json(
      await f("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: env.YOUTUBE_CLIENT_ID ?? "", client_secret: env.YOUTUBE_CLIENT_SECRET ?? "", redirect_uri: redirectUri("youtube"), grant_type: "authorization_code" }),
      }),
      "YouTube sign-in",
    );
    const tokens: Tokens = { accessToken: String(tok.access_token), refreshToken: tok.refresh_token ? String(tok.refresh_token) : undefined, expiresAt: inSeconds(tok.expires_in, now) };
    const me = await json(await f("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: `Bearer ${tokens.accessToken}` } }), "Reading the YouTube channel");
    const ch = (me.items as { id: string; snippet: { title: string } }[] | undefined)?.[0];
    if (!ch) throw new Error("That Google account has no YouTube channel");
    return { id: "youtube", platform, status: "connected", displayName: ch.snippet.title, externalId: ch.id, sealedTokens: sealTokens(platform, tokens), tokenExpiresAt: tokens.expiresAt, connectedAt: now.toISOString(), connectedBy: by };
  }
  const short = await json(
    await f("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.INSTAGRAM_APP_ID ?? "", client_secret: env.INSTAGRAM_APP_SECRET ?? "", grant_type: "authorization_code", redirect_uri: redirectUri("instagram"), code }),
    }),
    "Instagram sign-in",
  );
  const long = await json(
    await f(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: env.INSTAGRAM_APP_SECRET ?? "", access_token: String(short.access_token) })}`),
    "Instagram long-lived token",
  );
  const tokens: Tokens = { accessToken: String(long.access_token), expiresAt: inSeconds(long.expires_in, now) };
  const me = await json(await f(`https://graph.instagram.com/${IG_VERSION()}/me?fields=user_id,username&access_token=${encodeURIComponent(tokens.accessToken)}`), "Reading the Instagram account");
  return { id: "instagram", platform, status: "connected", displayName: `@${me.username}`, externalId: String(me.user_id ?? short.user_id), sealedTokens: sealTokens(platform, tokens), tokenExpiresAt: tokens.expiresAt, connectedAt: now.toISOString(), connectedBy: by };
}

/** A usable access token, refreshing it first when it expires within 10 minutes (YouTube) or 7 days (Instagram). */
export async function freshTokens(ch: ChannelAccount, f: Fetch = fetch, now = new Date()): Promise<{ tokens: Tokens; refreshed?: ChannelAccount }> {
  if (!ch.sealedTokens) throw new Error(`${ch.platform} is not connected`);
  const t = openTokens(ch.platform, ch.sealedTokens);
  const left = new Date(t.expiresAt).getTime() - now.getTime();
  if (ch.platform === "youtube") {
    if (left > 10 * 60_000) return { tokens: t };
    if (!t.refreshToken) throw new Error("YouTube needs to be connected again");
    const tok = await json(
      await f("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID ?? "", client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "", refresh_token: t.refreshToken, grant_type: "refresh_token" }),
      }),
      "YouTube token refresh",
    );
    const tokens = { ...t, accessToken: String(tok.access_token), expiresAt: inSeconds(tok.expires_in, now) };
    return { tokens, refreshed: { ...ch, sealedTokens: sealTokens("youtube", tokens), tokenExpiresAt: tokens.expiresAt } };
  }
  if (left > 7 * 86_400_000) return { tokens: t };
  if (left <= 0) throw new Error("The Instagram connection expired; connect it again");
  const tok = await json(await f(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t.accessToken)}`), "Instagram token refresh");
  const tokens = { accessToken: String(tok.access_token), expiresAt: inSeconds(tok.expires_in, now) };
  return { tokens, refreshed: { ...ch, sealedTokens: sealTokens("instagram", tokens), tokenExpiresAt: tokens.expiresAt } };
}

/* ---------- uploads ---------- */

export interface UploadInput {
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
  privacy: "private" | "public";
  /** Set when a realistic AI voice or AI imagery is used (YouTube altered or synthetic content disclosure). */
  synthetic: boolean;
}

export async function uploadToYouTube(accessToken: string, input: UploadInput, f: Fetch = fetch): Promise<{ id: string; url: string }> {
  const file = await f(input.videoUrl);
  if (!file.ok) throw new Error(`Could not read the rendered video (${file.status})`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const start = await f("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4",
      "x-upload-content-length": String(bytes.byteLength),
    },
    body: JSON.stringify({
      snippet: { title: input.title.slice(0, 100), description: input.description.slice(0, 5000), tags: input.tags.slice(0, 15), categoryId: "27" },
      status: { privacyStatus: input.privacy, selfDeclaredMadeForKids: false, containsSyntheticMedia: input.synthetic },
    }),
  });
  if (!start.ok) await json(start, "Starting the YouTube upload");
  const location = start.headers.get("location");
  if (!location) throw new Error("YouTube did not return an upload address");
  const done = await json(await f(location, { method: "PUT", headers: { "content-type": "video/mp4" }, body: bytes }), "Uploading to YouTube");
  const id = String(done.id);
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

export async function publishToInstagram(
  accessToken: string,
  userId: string,
  input: { videoUrl: string; caption: string },
  f: Fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<{ id: string; url?: string }> {
  const base = `https://graph.instagram.com/${IG_VERSION()}`;
  const container = await json(
    await f(`${base}/${userId}/media`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ media_type: "REELS", video_url: input.videoUrl, caption: input.caption.slice(0, 2200), share_to_feed: "true", access_token: accessToken }),
    }),
    "Creating the Instagram Reel",
  );
  const creationId = String(container.id);
  for (let i = 0; i < 30; i++) {
    const s = await json(await f(`${base}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`), "Checking the Instagram upload");
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram could not process the video (${s.status_code})`);
    if (i === 29) throw new Error("Instagram is still processing the video; it will be retried");
    await wait(10_000);
  }
  const pub = await json(
    await f(`${base}/${userId}/media_publish`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
    }),
    "Publishing the Instagram Reel",
  );
  const id = String(pub.id);
  const link = await f(`${base}/${id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return { id, url: (link as { permalink?: string }).permalink };
}
