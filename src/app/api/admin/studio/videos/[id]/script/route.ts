import { readJson, withActor } from "@/server/http";
import { editScript } from "@/server/studio/pipeline";
import { getStudioStore } from "@/server/studio/store";
import type { BeatRole, Script } from "@/server/studio/types";

const ROLES = new Set<BeatRole>(["hook", "question", "answer", "example", "steps", "myth", "next_step", "cta"]);
const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

function parseScript(raw: unknown): Script {
  const s = (raw ?? {}) as Record<string, unknown>;
  const beats = Array.isArray(s.beats) ? s.beats : [];
  if (!beats.length || beats.length > 80) throw new Error("A script needs between 1 and 80 beats");
  const cta = (s.cta ?? {}) as Record<string, unknown>;
  return {
    title: str(s.title, 100),
    description: str(s.description, 3000),
    hashtags: (Array.isArray(s.hashtags) ? s.hashtags : []).slice(0, 10).map((h) => str(h, 40).replace(/[^\w]/g, "")).filter(Boolean),
    beats: beats.map((b, i) => {
      const r = (b ?? {}) as Record<string, unknown>;
      const role = ROLES.has(r.role as BeatRole) ? (r.role as BeatRole) : "answer";
      return {
        id: str(r.id, 20) || `b${i + 1}`,
        role,
        narration: str(r.narration, 2000),
        onScreen: str(r.onScreen, 140),
        points: Array.isArray(r.points) ? r.points.slice(0, 6).map((p) => str(p, 140)).filter(Boolean) : undefined,
        sourceIds: Array.isArray(r.sourceIds) ? r.sourceIds.map((x) => str(x, 10)) : [],
        fictional: r.fictional === true || undefined,
      };
    }),
    cta: { label: str(cta.label, 80), path: str(cta.path, 200).startsWith("/") ? str(cta.path, 200) : "/contact" },
    chapters: Array.isArray(s.chapters) ? s.chapters.slice(0, 20).map((c) => ({ beatId: str((c as Record<string, unknown>).beatId, 20), title: str((c as Record<string, unknown>).title, 80) })) : undefined,
  };
}

/** Marketing edits the script by hand. Clears any approval; the checks run again. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ script?: unknown }>(request);
    const v = await editScript(await getStudioStore(), actor, id, parseScript(body.script));
    return { id: v.id, stage: v.stage, passed: v.quality?.passed };
  });
}
