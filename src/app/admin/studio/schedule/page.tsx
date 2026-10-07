import Link from "next/link";
import { canStudio } from "@/server/studio/access";
import { describeRecurrence, getSettings, slots } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";
import { currentActor } from "@/server/runtime";
import { BufferForm, SeriesCard } from "../StudioActions";
import { fmtTime, StudioNav } from "../shared";
import styles from "../studio.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio schedule", robots: { index: false, follow: false } };

export default async function SchedulePage() {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!canStudio(actor, "view_studio")) return <p>The video studio is for marketing, admins and the attorney.</p>;
  const store = await getStudioStore();
  const settings = await getSettings(store);
  const videos = await store.listVideos();
  const bySlot = new Map(videos.flatMap((v) => (v.slots ?? []).map((s) => [`${s.seriesId}|${s.at}`, v] as const)));
  const upcoming = slots(settings, new Date(), 2);
  const names = new Map(settings.series.map((s) => [s.id, s.name]));
  const canEdit = canStudio(actor, "manage_channels");

  return (
    <>
      <h1>Schedule</h1>
      <StudioNav />
      <p className="lead">Each series posts on its own pattern. Approved videos take the next open slot; a short goes out on YouTube Shorts and Instagram Reels.</p>
      {!canEdit && <p className="notice">Only a platform admin can switch series on or off or change their times.</p>}

      <section className={styles.seriesList} aria-label="Series">
        {settings.series.map((s) => <SeriesCard key={s.id} series={s} describe={describeRecurrence(s.recurrence)} canEdit={canEdit} />)}
      </section>

      <h2>Coming up next</h2>
      <table>
        <thead><tr><th scope="col">When (Chicago)</th><th scope="col">Series</th><th scope="col">Video</th><th scope="col">Render</th></tr></thead>
        <tbody>
          {upcoming.map((s) => {
            const v = bySlot.get(`${s.seriesId}|${s.at.toISOString()}`);
            return (
              <tr key={s.seriesId + s.at.toISOString()}>
                <td>{fmtTime(s.at.toISOString())}</td>
                <td>{names.get(s.seriesId)}</td>
                <td>{v ? <Link href={`/admin/studio/${v.id}`}>{v.script?.title ?? v.topic.question}</Link> : <span className="notice">Open: approve more videos to fill it</span>}</td>
                <td>{v ? v.render.status.replace("_", " ") : ""}</td>
              </tr>
            );
          })}
          {upcoming.length === 0 && <tr><td colSpan={4}>Every series is switched off.</td></tr>}
        </tbody>
      </table>
      {canEdit && <div style={{ marginTop: 24 }}><BufferForm bufferDays={settings.bufferDays} /></div>}
    </>
  );
}
