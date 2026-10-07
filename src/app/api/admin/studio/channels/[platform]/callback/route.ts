import { NextResponse } from "next/server";
import { site } from "@/config/site";
import { withActor } from "@/server/http";
import { assertStudio } from "@/server/studio/access";
import { connect } from "@/server/studio/channels";
import { getStudioStore } from "@/server/studio/store";

/** OAuth return. Checks the state cookie, stores the sealed tokens, then goes back to the channels page. */
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  return withActor(request, async ({ actor }) => {
    assertStudio(actor, "manage_channels");
    if (platform !== "youtube" && platform !== "instagram") throw new Error("Unknown platform");
    const url = new URL(request.url);
    const cookie = /(?:^|;\s*)ep_studio_oauth=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
    const back = new URL("/admin/studio/channels", site.url);
    if (!cookie || cookie !== url.searchParams.get("state") || !cookie.startsWith(`${platform}.`)) {
      back.searchParams.set("error", "The sign-in could not be verified. Try connecting again.");
      return NextResponse.redirect(back);
    }
    const code = url.searchParams.get("code");
    if (!code) {
      back.searchParams.set("error", url.searchParams.get("error_description") ?? "Sign-in was cancelled");
      return NextResponse.redirect(back);
    }
    const store = await getStudioStore();
    try {
      await store.saveChannel(await connect(platform, code, actor.userId));
      back.searchParams.set("connected", platform);
    } catch (err) {
      back.searchParams.set("error", err instanceof Error ? err.message : "Could not connect");
    }
    const res = NextResponse.redirect(back);
    res.cookies.delete({ name: "ep_studio_oauth", path: "/api/admin/studio/channels" });
    return res;
  });
}
