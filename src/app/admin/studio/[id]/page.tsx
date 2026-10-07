import Link from "next/link";
import { notFound } from "next/navigation";
import { canStudio } from "@/server/studio/access";
import { publishMode } from "@/server/studio/config";
import { planSeconds } from "@/server/studio/director";
import { contentHash, isApproved } from "@/server/studio/pipeline";
import { productionSteps, type StepState } from "@/server/studio/progress";
import { caption, PLACES } from "@/server/studio/publish";
import { getSettings, postedOn } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";
import type { Platform, StudioVideo } from "@/server/studio/types";
import { currentActor } from "@/server/runtime";
import StudioPreview from "../StudioPreview";
import { PlacesForm, PostButton, ReviewForm, ScriptEditor, type PlaceRow } from "../StudioActions";
import { fmtTime, STAGE_LABEL, StudioNav } from "../shared";
import styles from "../studio.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video", robots: { index: false, follow: false } };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const PLATFORM_NAME: Record<Platform, string> = { youtube: "YouTube", instagram: "Instagram" };
const STATE_LABEL: Record<StepState, string> = { done: "Done", next: "Next to run", waiting: "Waiting", flagged: "Flagged", skipped: "Skipped" };

function stageBadge(v: StudioVideo): string {
  if (v.stage === "published" || v.stage === "approved" || v.stage === "scheduled") return styles.badge;
  if (v.stage === "in_review" || v.stage === "scripted" || v.stage === "idea") return `${styles.badge} ${styles.badgeWarn}`;
  return `${styles.badge} ${styles.badgeBad}`;
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!canStudio(actor, "view_studio")) return <p>The video studio is for marketing, admins and the attorney.</p>;
  const { id } = await params;
  const store = await getStudioStore();
  const v = await store.getVideo(id);
  if (!v) notFound();
  const mode = publishMode();
  const settings = await getSettings(store);
  const seriesName = new Map(settings.series.map((s) => [s.id, s.name]));
  const reviewable = ["in_review", "changes_requested"].includes(v.stage) && Boolean(v.plan);
  const sources = new Map(v.research?.sources.map((s) => [s.id, s]) ?? []);
  const steps = productionSteps(v, mode);
  const channels = new Map((await Promise.all(PLACES[v.format].map((p) => store.getChannel(p)))).filter(Boolean).map((c) => [c!.platform, c!]));

  const places: PlaceRow[] = PLACES[v.format].map((platform) => {
    const ch = channels.get(platform);
    const label = v.format === "long" ? "YouTube" : platform === "youtube" ? "YouTube Shorts" : "Instagram Reels";
    const name = ch?.status === "connected" && ch.displayName ? `${ch.displayName} · ${label}` : `${label}${ch?.status === "connected" ? "" : " (not connected)"}`;
    const post = v.posts.filter((p) => p.platform === platform).sort((a, b) => b.at.localeCompare(a.at))[0];
    const slot = v.slots?.find((s) => s.platform === platform);
    const state =
      post && post.status === "posted" ? `Live${post.privacy === "private" ? " (private)" : ""} since ${fmtTime(post.at)}`
      : post && post.status === "logged" ? `Logged ${fmtTime(post.at)}; publishing was ${post.mode}${post.error ? `. ${post.error}` : ""}`
      : slot ? `Scheduled ${fmtTime(slot.at)} in ${seriesName.get(slot.seriesId)}${post?.status === "failed" ? `; last try failed: ${post.error}` : ""}`
      : post?.status === "failed" ? `Failed: ${post.error}`
      : v.targets.includes(platform) ? "Not posted yet; takes the next open slot once approved" : "Not going here";
    return { platform, name, state, live: postedOn(v, platform), url: post?.status === "posted" ? post.url : undefined, pickable: !postedOn(v, platform) };
  });
  const placesDone = PLACES[v.format].filter((p) => postedOn(v, p)).length;
  const firstPost = v.posts.filter((p) => p.status !== "failed").map((p) => p.at).sort()[0];
  const revisions = v.history.filter((h) => h.event === "edited").length + Math.max(0, v.history.filter((h) => h.event === "written").length - 1);
  const renders = v.history.filter((h) => h.event.startsWith("render_")).length;
  const canPost = canStudio(actor, "make_videos") && (v.stage === "approved" || v.stage === "scheduled" || v.stage === "published") && isApproved(v);

  return (
    <>
      <StudioNav />
      <div className={styles.wide}>
      <h1>{v.script?.title ?? v.topic.question}</h1>
      <p><strong>Viewer&apos;s question:</strong> {v.topic.question}</p>
      <section className={styles.panel} aria-label="Production steps">
        <p className={styles.kicker}>Production steps</p>
        <ol className={styles.steps}>
          {steps.map((s) => (
            <li key={s.id} className={styles.step}>
              <span className={`${styles.dot} ${styles[s.state]}`} title={STATE_LABEL[s.state]} aria-hidden="true" />
              <span>{s.label}</span>
              <span className={styles.stepNote}>{STATE_LABEL[s.state]}{s.note ? ` · ${s.note}` : ""}</span>
            </li>
          ))}
        </ol>
        <div className={styles.legend}>
          {(Object.keys(STATE_LABEL) as StepState[]).map((k) => <span key={k}><span className={`${styles.dot} ${styles.small} ${styles[k]}`} aria-hidden="true" />{STATE_LABEL[k]}</span>)}
        </div>
      </section>

      <div className={styles.videoLayout}>
        <div>
          {v.plan && (
            <section style={{ maxWidth: v.format === "short" ? 360 : 900, margin: "0 0 20px" }}>
              <StudioPreview plan={v.plan} />
              <p className="notice">Preview of the exact video that will be rendered{v.plan.audioSrc ? "" : " (silent with captions until a voice is switched on)"}.</p>
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

          {v.quality && (
            <section className={styles.panel}>
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

          <section style={{ marginTop: 24 }}>
            <h2>History</h2>
            <ul>{v.history.slice().reverse().map((h, i) => <li key={i}>{fmtTime(h.at)} · {h.event.replaceAll("_", " ")} · {h.by}{h.note && <span className="notice"> · {h.note}</span>}</li>)}</ul>
          </section>
        </div>

        <aside>
          <section className={styles.panel} aria-label="Details">
            <h2 style={{ marginTop: 0 }}>Details</h2>
            <dl className={styles.details}>
              <div><dt>Status</dt><dd><span className={stageBadge(v)}>{STAGE_LABEL[v.stage]}</span></dd></div>
              <div><dt>Format</dt><dd>{v.format === "long" ? "Long video" : "Short (vertical)"}</dd></div>
              {v.plan && <div><dt>Length</dt><dd>{mmss(planSeconds(v.plan))}</dd></div>}
              <div><dt>Topic</dt><dd>{v.topic.cluster.replaceAll("-", " ")}{v.topic.state === "IL" ? " · Illinois" : ""}</dd></div>
              <div><dt>Risk</dt><dd>{v.topic.risk}</dd></div>
              <div><dt>Writer</dt><dd>{v.research?.writer ?? "Not written yet"}</dd></div>
              <div><dt>Approved</dt><dd>{isApproved(v) && v.review ? fmtTime(v.review.at) : "Not yet"}</dd></div>
              <div><dt>Created</dt><dd>{fmtTime(v.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{fmtTime(v.updatedAt)}</dd></div>
              <div><dt>Scheduled</dt><dd>{v.slots?.length ? v.slots.map((s) => <span key={s.seriesId} style={{ display: "block" }}>{seriesName.get(s.seriesId)}: {fmtTime(s.at)}</span>) : "Not yet"}</dd></div>
              <div><dt>Live</dt><dd>On {placesDone} of {PLACES[v.format].length} place{PLACES[v.format].length > 1 ? "s" : ""}</dd></div>
              <div><dt>{mode === "off" ? "Logged" : "Posted"}</dt><dd>{firstPost ? fmtTime(firstPost) : "Not yet"}</dd></div>
              <div><dt>Render attempts</dt><dd>{renders}</dd></div>
              <div><dt>Revisions</dt><dd>{revisions}</dd></div>
            </dl>
          </section>

          <section className={styles.panel} aria-label="Where it goes">
            <h2 style={{ marginTop: 0 }}>Where it goes</h2>
            <p className="notice">
              {mode === "off" ? "Publishing is off, so posts are only logged." : "Posts once per place. A place it is already live on cannot be posted to again."}
              {v.format === "long" ? " Long videos go to YouTube only." : ""}
            </p>
            <PlacesForm id={v.id} rows={places} picked={v.targets} canPost={canPost} mode={mode} />
            {!canPost && <p className="notice">You can pick places and post once the attorney approves this video.</p>}
          </section>
        </aside>
      </div>
      </div>
    </>
  );
}
