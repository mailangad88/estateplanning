import Link from "next/link";
import { canStudio } from "@/server/studio/access";
import { getSettings, slots } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";
import { currentActor } from "@/server/runtime";
import { SettingsForm } from "../StudioActions";
import { fmtTime, StudioNav } from "../shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio schedule", robots: { index: false, follow: false } };

export default async function SchedulePage() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!canStudio(actor, "view_studio")) return <p>The video studio is for marketing, admins and the attorney.</p>;
  const store = await getStudioStore();
  const settings = await getSettings(store);
  const videos = await store.listVideos();
  const bySlot = new Map(videos.filter((v) => v.slotAt).map((v) => [v.slotAt!, v]));
  const upcoming = slots(settings, new Date(), 3);

  return (
    <>
      <h1>Schedule</h1>
      <StudioNav />
      <p className="lead">The next three days of publish slots. Approved videos fill the earliest open slot of their format.</p>
      <table>
        <thead><tr><th scope="col">When (Chicago)</th><th scope="col">Slot</th><th scope="col">Video</th><th scope="col">Render</th></tr></thead>
        <tbody>
          {upcoming.map((s) => {
            const v = bySlot.get(s.at.toISOString());
            return (
              <tr key={s.at.toISOString() + s.format}>
                <td>{fmtTime(s.at.toISOString())}</td>
                <td>{s.format === "long" ? "Long (YouTube)" : "Short (YouTube and Instagram)"}</td>
                <td>{v ? <Link href={`/admin/studio/${v.id}`}>{v.script?.title ?? v.topic.question}</Link> : <span className="notice">Open: approve more videos to fill it</span>}</td>
                <td>{v ? v.render.status.replace("_", " ") : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canStudio(actor, "manage_channels") ? <div style={{ marginTop: 24 }}><SettingsForm longSlots={settings.longSlots} shortSlots={settings.shortSlots} bufferDays={settings.bufferDays} /></div> : <p className="notice">Only a platform admin can change the publish times.</p>}
    </>
  );
}
