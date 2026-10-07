import Link from "next/link";
import { canStudio } from "@/server/studio/access";
import { writerKind } from "@/server/studio/config";
import { bufferStatus, getSettings } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";
import type { Stage, StudioVideo } from "@/server/studio/types";
import { currentActor } from "@/server/runtime";
import { GenerateForm } from "./StudioActions";
import { fmtTime, STAGE_LABEL, StudioNav } from "./shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video studio", robots: { index: false, follow: false } };

const COLUMNS: { title: string; stages: Stage[]; note: string }[] = [
  { title: "Waiting for attorney", stages: ["in_review"], note: "Passed every check. Watch the preview, then approve or send back." },
  { title: "Needs work", stages: ["needs_rewrite", "changes_requested"], note: "Failed a check or sent back. Edit the script or rewrite it." },
  { title: "Approved and scheduled", stages: ["approved", "scheduled"], note: "Rendered after approval, then posted at its time." },
  { title: "Published", stages: ["published"], note: "Posted (or logged while publishing is off)." },
];

function Row({ v }: { v: StudioVideo }) {
  const blocking = v.quality?.checks.filter((c) => !c.ok && c.level === "block").length ?? 0;
  return (
    <tr>
      <td><Link href={`/admin/studio/${v.id}`}>{v.script?.title ?? v.topic.question}</Link>{v.topic.state === "IL" && <span className="notice"> · Illinois</span>}</td>
      <td>{v.format === "long" ? "Long" : "Short"}</td>
      <td>{STAGE_LABEL[v.stage]}{blocking ? ` (${blocking} failed check${blocking > 1 ? "s" : ""})` : ""}</td>
      <td>{v.slotAt ? fmtTime(v.slotAt) : v.render.status !== "not_started" ? `Render: ${v.render.status}` : ""}</td>
    </tr>
  );
}

export default async function StudioHome() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!canStudio(actor, "view_studio")) return <p>The video studio is for marketing, admins and the attorney.</p>;
  const store = await getStudioStore();
  const videos = (await store.listVideos()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const settings = await getSettings(store);
  const buffer = bufferStatus(settings, videos);
  const writer = writerKind() === "anthropic" ? "Claude (researches, writes and fact-checks; pay as you go)" : "Site draft (free; builds scripts from our own pages)";

  return (
    <>
      <h1>Video studio</h1>
      <StudioNav />
      <p className="lead">Research, write, check, review and schedule videos for YouTube and Instagram. Every video needs the attorney&apos;s approval before it can post.</p>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Ready to post</h2>
        <table>
          <thead><tr><th scope="col">Format</th><th scope="col">A day</th><th scope="col">Scheduled</th><th scope="col">Approved, waiting for a slot</th><th scope="col">Waiting for attorney</th><th scope="col">Days covered</th></tr></thead>
          <tbody>
            {buffer.map((b) => (
              <tr key={b.format}><td>{b.format === "long" ? "Long videos" : "Shorts"}</td><td>{b.perDay}</td><td>{b.scheduled}</td><td>{b.approvedWaiting}</td><td>{b.inReview}</td><td>{b.daysReady}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {canStudio(actor, "make_videos") && <GenerateForm writer={writer} />}

      {COLUMNS.map((col) => {
        const rows = videos.filter((v) => col.stages.includes(v.stage));
        return (
          <section key={col.title} style={{ marginTop: 24 }}>
            <h2>{col.title} ({rows.length})</h2>
            <p className="notice">{col.note}</p>
            {rows.length === 0 ? <p>Nothing here.</p> : (
              <table>
                <thead><tr><th scope="col">Video</th><th scope="col">Format</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
                <tbody>{rows.slice(0, 50).map((v) => <Row key={v.id} v={v} />)}</tbody>
              </table>
            )}
          </section>
        );
      })}
    </>
  );
}
