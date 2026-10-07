import { withActor } from "@/server/http";
import { assertStudio } from "@/server/studio/access";
import { getStudioStore } from "@/server/studio/store";

/** Forgets the stored tokens. Revoke the app's access in Google or Instagram settings too. */
export async function POST(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  return withActor(request, async ({ actor }) => {
    assertStudio(actor, "manage_channels");
    if (platform !== "youtube" && platform !== "instagram") throw new Error("Unknown platform");
    await (await getStudioStore()).saveChannel({ id: platform, platform, status: "not_connected" });
    return { ok: true };
  });
}
