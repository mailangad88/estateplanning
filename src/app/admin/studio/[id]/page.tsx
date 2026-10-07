import Link from "next/link";
import { notFound } from "next/navigation";
import { canStudio } from "@/server/studio/access";
import { planSeconds } from "@/server/studio/director";
import { contentHash, isApproved } from "@/server/studio/pipeline";
import { caption } from "@/server/studio/publish";
import { getStudioStore } from "@/server/studio/store";
import { currentActor } from "@/server/runtime";
import StudioPreview from "../StudioPreview";
import { PostButton, ReviewForm, ScriptEditor } from "../StudioActions";
import { fmtTime, STAGE_LABEL, StudioNav } from "../shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video", robots: { index: false, follow: false } };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!canStudio(actor, "view_studio")) return <p>The video studio is for marketing, admins and the attorney.</p>;
  const { id } = await params;
  const v = await (await getStudioStore()).getVideo(id);
  if (!v) notFound();
  const reviewable = ["in_review", "changes_requested"].includes(v.stage) && Boolean(v.plan);
  const sources = new Map(v.research?.sources.map((s) => [s.id, s]) ?? []);

  return (
    <>
      <StudioNav />
      <h1>{v.script?.title ?? v.topic.question}</h1>
      <p className="notice">
        {v.format === "long" ? "Long YouTube video" : "Short for YouTube Shorts and Instagram Reels"} · {STAGE_LABEL[v.stage]}
        {v.plan && <> · {mmss(planSeconds(v.plan))}</>}
        {v.slotAt && <> · posts {fmtTime(v.slotAt)}</>}
        {isApproved(v) && v.review && <> · approved {fmtTime(v.review.at)}</>}
      </p>
      <p><strong>Viewer&apos;s question:</strong> {v.topic.question} <span className="notice">({v.topic.cluster}{v.topic.state === "IL" ? ", Illinois" : ""}, {v.topic.risk} risk)</span></p>

      {v.plan && (
        <section style={{ maxWidth: v.format === "short" ? 360 : 900, margin: "16px 0" }}>
          <StudioPreview plan={v.plan} />
          <p className="notice">Preview of the exact video that will be rendered{v.plan.audioSrc ? "" : " (silent with captions until a voice is switched on)"}.</p>
        </section>
      )}

      {v.quality && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Checks</h2>
          <ul>
            {v.quality.checks.map((c) => (
              <li key={c.id} className={c.ok ? undefined : c.level === "block" ? "error" : undefined}>
                {c.ok ? "Pass" : c.level === "block" ? "Fails" : "Check"}: {c.detail}
              </li>
            ))}
          </ul>
          {v.quality.editorNotes.length > 0 && (<><h3>Editor notes</h3><ul>{v.quality.editorNotes.map((n, i) => <li key={i}>{n}</li>)}</ul></>)}
        </section>
      )}

      {reviewable && canStudio(actor, "review_videos") && <ReviewForm id={v.id} contentHash={contentHash(v)} attorney={actor.role === "attorney"} />}
      {v.review && v.review.decision !== "approved" && <p className="error">Sent back {fmtTime(v.review.at)}: {v.review.note}</p>}

      {canStudio(actor, "make_videos") && v.stage !== "published" && (
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          {v.script && <ScriptEditor id={v.id} script={v.script} />}
          <PostButton url={`/api/admin/studio/videos/${v.id}/rewrite`} label="Rewrite from scratch" confirm="Replace this script with a fresh draft?" secondary />
          {v.stage === "scheduled" && <PostButton url={`/api/admin/studio/videos/${v.id}/unschedule`} label="Take off the schedule" secondary />}
        </p>
      )}

      {v.script && (
        <section style={{ marginTop: 24 }}>
          <h2>Script</h2>
          <table>
            <thead><tr><th scope="col">Beat</th><th scope="col">On screen</th><th scope="col">Narration</th><th scope="col">Sources</th></tr></thead>
            <tbody>
              {v.script.beats.map((b) => (
                <tr key={b.id}>
                  <td>{b.id} · {b.role.replace("_", " ")}{b.fictional ? " · fictional example" : ""}</td>
                  <td>{b.onScreen}{b.points && <ul>{b.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}</td>
                  <td>{b.narration}</td>
                  <td>{b.sourceIds.map((s) => sources.get(s)?.url ? <a key={s} href={sources.get(s)!.url} target="_blank" rel="noreferrer">{s} </a> : <span key={s}>{s} </span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Post text</h3>
          {v.targets.map((p) => (
            <details key={p}><summary>{p === "youtube" ? "YouTube description" : "Instagram caption"}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{caption(v, p)}</pre></details>
          ))}
        </section>
      )}

      {v.research && (
        <section style={{ marginTop: 24 }}>
          <h2>Research</h2>
          <p>{v.research.summary}</p>
          <ol>
            {v.research.sources.map((s) => (
              <li key={s.id}><strong>{s.id}</strong> {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title} <span className="notice">({s.kind.replace("_", " ")})</span>{s.quote && <><br /><span className="notice">“{s.quote}”</span></>}</li>
            ))}
          </ol>
          <p className="notice">Written by {v.research.writer}. Call to action links to {v.research.landingPath}.</p>
        </section>
      )}

      {v.posts.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Posts</h2>
          <ul>{v.posts.map((p, i) => <li key={i}>{p.platform}: {p.status}{p.privacy ? ` (${p.privacy})` : ""} {fmtTime(p.at)} {p.url && <a href={p.url}>open</a>} {p.error && <span className="notice">{p.error}</span>}</li>)}</ul>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>History</h2>
        <ul>{v.history.slice().reverse().map((h, i) => <li key={i}>{fmtTime(h.at)} · {h.event.replaceAll("_", " ")} · {h.by}{h.note && <span className="notice"> · {h.note}</span>}</li>)}</ul>
      </section>
    </>
  );
}
