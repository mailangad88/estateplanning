import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { withActor } from "@/server/http";
import { assertStudio } from "@/server/studio/access";
import { authorizeUrl, oauthConfigured } from "@/server/studio/channels";

const OAUTH_STATE_COOKIE = "ep_studio_oauth";

/** Starts the YouTube or Instagram sign-in. The state value is checked on the way back. */
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  return withActor(request, async ({ actor }) => {
    assertStudio(actor, "manage_channels");
    if (platform !== "youtube" && platform !== "instagram") throw new Error("Unknown platform");
    if (!oauthConfigured(platform)) throw new Error(`Set the ${platform === "youtube" ? "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET" : "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET"} environment variables first`);
    const state = `${platform}.${randomBytes(18).toString("base64url")}`;
    const res = NextResponse.redirect(authorizeUrl(platform, state));
    res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin/studio/channels", maxAge: 600 });
    return res;
  });
}
