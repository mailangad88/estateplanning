import Link from "next/link";
import { canStudio } from "@/server/studio/access";
import { oauthConfigured, redirectUri } from "@/server/studio/channels";
import { publishMode } from "@/server/studio/config";
import { getStudioStore } from "@/server/studio/store";
import type { Platform } from "@/server/studio/types";
import { currentActor } from "@/server/runtime";
import { PostButton } from "../StudioActions";
import { fmtTime, StudioNav } from "../shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio channels", robots: { index: false, follow: false } };

const SETUP: Record<Platform, { name: string; env: string; steps: string[] }> = {
  youtube: {
    name: "YouTube",
    env: "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET",
    steps: [
      "Pick or create the channel and verify it by phone in YouTube Studio (needed for videos over 15 minutes and custom thumbnails).",
      "In Google Cloud, create a project, turn on the YouTube Data API v3, set up the OAuth consent screen and create a web OAuth client with the redirect address below.",
      "Put the client id and secret in the environment, then click Connect.",
      "Request YouTube's API audit for the project. Until it passes, uploads from the API can only be private.",
    ],
  },
  instagram: {
    name: "Instagram",
    env: "INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET",
    steps: [
      "Switch the Instagram account to a Professional (Business or Creator) account.",
      "Create a Meta developer app with the Instagram API (Instagram login), add yourself as admin and add the redirect address below.",
      "Put the app id and secret in the environment, then click Connect.",
      "Reels need the rendered video at a public web address (the render worker uploads it to storage).",
    ],
  },
};

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!canStudio(actor, "view_studio")) return <p>The video studio is for marketing, admins and the attorney.</p>;
  const sp = await searchParams;
  const store = await getStudioStore();
  const manage = canStudio(actor, "manage_channels");
  const channels = { youtube: await store.getChannel("youtube"), instagram: await store.getChannel("instagram") };

  return (
    <>
      <h1>Channels</h1>
      <StudioNav />
      {sp.error && <p className="error" role="alert">{sp.error}</p>}
      {sp.connected && <p className="notice" role="status">Connected {sp.connected}.</p>}
      <p className="notice">Publishing mode: <strong>{publishMode()}</strong>. It is set with the STUDIO_PUBLISH_MODE environment variable (off, private or live), so it cannot be switched on by accident from this page.</p>
      <ul className="card-grid">
        {(["youtube", "instagram"] as Platform[]).map((p) => {
          const ch = channels[p];
          const s = SETUP[p];
          return (
            <li key={p} className="card">
              <h2 style={{ margin: 0 }}>{s.name}</h2>
              {ch?.status === "connected" ? (
                <p>Connected as <strong>{ch.displayName}</strong> on {fmtTime(ch.connectedAt)}.</p>
              ) : (
                <p>Not connected.</p>
              )}
              <ol>{s.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
              <p className="notice">Redirect address: <code>{redirectUri(p)}</code><br />Environment: <code>{s.env}</code></p>
              {manage && (oauthConfigured(p)
                ? <p style={{ display: "flex", gap: 8 }}><a className="button small" href={`/api/admin/studio/channels/${p}/connect`}>{ch?.status === "connected" ? "Reconnect" : "Connect"}</a>{ch?.status === "connected" && <PostButton url={`/api/admin/studio/channels/${p}/disconnect`} label="Disconnect" confirm={`Disconnect ${s.name}?`} secondary />}</p>
                : <p className="notice">Connect appears once the environment variables are set.</p>)}
            </li>
          );
        })}
      </ul>
    </>
  );
}
