/**
 * Social video studio: data model. One StudioVideo moves through the pipeline
 * research -> script -> edit -> direct -> render -> attorney review -> schedule -> publish.
 * The director's VideoPlan is the contract with the Remotion templates in src/studio/video.
 */

export type VideoFormat = "long" | "short";
export type Platform = "youtube" | "instagram";

export type Stage =
  | "idea" // topic picked, nothing written yet
  | "scripted" // research, storyline and script written
  | "needs_rewrite" // the edit pass or the quality gates failed; see quality
  | "in_review" // passed the gates, waiting on the attorney
  | "changes_requested" // the attorney sent it back
  | "approved" // the attorney approved this exact script and plan
  | "scheduled" // given a publish slot
  | "published" // posted to every target channel (or logged, when publishing is off)
  | "rejected"; // dropped

export interface Topic {
  question: string;
  cluster: string;
  intent: string;
  risk: "low" | "medium" | "high";
  /** Illinois-specific question (launch state) or general. */
  state: "IL" | null;
  /** Page on our site that answers it, if any (from content/questions.json coveredBy). */
  coveredBy: string | null;
  /** Free resource, /decide guide and what-if scenarios the question bank pairs with it. */
  resource: string | null;
  decide: string | null;
}

export interface SourceRef {
  id: string; // s1, s2...
  kind: "site_page" | "fact" | "web";
  title: string;
  url?: string;
  /** The passage the claim rests on, short. */
  quote?: string;
  /** Fact registry id when kind is "fact". */
  factId?: string;
}

export type BeatRole = "hook" | "question" | "answer" | "example" | "steps" | "myth" | "next_step" | "cta";

export interface ScriptBeat {
  id: string; // b1, b2...
  role: BeatRole;
  /** Spoken narration, plain language. */
  narration: string;
  /** Short on-screen headline (under about 8 words). */
  onScreen: string;
  /** Bullet points for steps, myths, comparisons. */
  points?: string[];
  /** Sources backing every factual claim in this beat. */
  sourceIds: string[];
  /** True for a made-up family or scenario; renders a "Fictional example" label. */
  fictional?: boolean;
}

export interface Script {
  title: string;
  /** YouTube description / Instagram caption body (disclaimers and links are appended at publish). */
  description: string;
  hashtags: string[];
  beats: ScriptBeat[];
  /** Where the call to action sends people, with UTM tags added at publish. */
  cta: { label: string; path: string };
  /** For long videos: chapter titles keyed by the beat they start at. */
  chapters?: { beatId: string; title: string }[];
}

export interface Research {
  summary: string;
  sources: SourceRef[];
  /** The site page or tool the video points to. */
  landingPath: string;
  writer: string; // which writer produced it, e.g. "anthropic:claude-opus-5-5" or "site-draft"
}

/* ---------- director output: the Remotion contract ---------- */

export type SceneTemplate =
  | "title" // hook headline over the brand background
  | "question" // the viewer's question as a card
  | "statement" // one headline plus a short supporting line
  | "points" // a checklist or numbered steps (2 to 5 points)
  | "myth" // "Myth" vs "Fact" two panels: points[0] is the myth, points[1] the fact
  | "example" // fictional family example, labelled
  | "cta"; // end card: booking link, firm name, office address, disclaimer

export interface Scene {
  id: string;
  beatId: string;
  template: SceneTemplate;
  /** Seconds this scene is on screen; the narration fits inside it. */
  durationSec: number;
  headline: string;
  body?: string;
  points?: string[];
  /** Icon name from the site's icon set (src/components/visuals/icons), optional. */
  icon?: string;
  /** Narration for captions (and voice, when audio is on). */
  caption: string;
  /** Renders a visible "Fictional example" tag. */
  fictional?: boolean;
  /** Chapter title for long videos, shown as a small kicker. */
  chapter?: string;
}

export interface VideoPlan {
  format: VideoFormat;
  width: number; // 1920x1080 long, 1080x1920 short
  height: number;
  fps: 30;
  title: string;
  scenes: Scene[];
  /** Always on screen in small type. */
  disclaimer: string;
  endCard: {
    url: string; // shown on screen, short form
    firmName: string;
    officeAddress: string;
    advertisingLabel: string;
  };
  /** Voiceover file URL; absent means silent with burned-in captions. */
  audioSrc?: string;
}

/* ---------- checks, review, publishing ---------- */

export interface QualityCheck {
  id: string;
  ok: boolean;
  /** Blocking checks stop the video reaching review; warnings are shown to the attorney. */
  level: "block" | "warn";
  detail: string;
}

export interface QualityReport {
  passed: boolean;
  checks: QualityCheck[];
  /** Notes from the editor pass (LLM or site draft). */
  editorNotes: string[];
}

export interface ReviewDecision {
  decision: "approved" | "changes_requested" | "rejected";
  by: string; // user id
  byName?: string;
  role: string;
  at: string;
  note?: string;
  /** sha256 of script + plan exactly as reviewed. An edit after approval invalidates it. */
  contentHash: string;
}

export interface RenderInfo {
  status: "not_started" | "queued" | "rendering" | "done" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  captionsUrl?: string;
  error?: string;
  updatedAt: string;
}

export interface PostRecord {
  platform: Platform;
  mode: PublishMode;
  status: "logged" | "posted" | "failed";
  at: string;
  externalId?: string;
  url?: string;
  /** youtube privacy status actually used */
  privacy?: "private" | "public";
  error?: string;
}

export interface HistoryEntry {
  at: string;
  by: string; // user id or "system"
  event: string;
  note?: string;
}

export interface StudioVideo {
  id: string;
  format: VideoFormat;
  topic: Topic;
  stage: Stage;
  research?: Research;
  script?: Script;
  plan?: VideoPlan;
  quality?: QualityReport;
  review?: ReviewDecision;
  render: RenderInfo;
  /** ISO time of the publish slot. */
  slotAt?: string;
  targets: Platform[];
  posts: PostRecord[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * off: nothing leaves the building; the scheduler logs what it would post.
 * private: YouTube uploads as private (you flip them public in YouTube Studio); Instagram is skipped
 *   because it has no private posts.
 * live: public posts on both.
 */
export type PublishMode = "off" | "private" | "live";

export interface ChannelAccount {
  id: Platform;
  platform: Platform;
  status: "not_connected" | "connected" | "error";
  displayName?: string;
  externalId?: string; // YouTube channel id, Instagram user id
  /** AES-GCM sealed token bundle (see crypto.ts). Never sent to the browser. */
  sealedTokens?: string;
  tokenExpiresAt?: string;
  connectedAt?: string;
  connectedBy?: string;
  lastError?: string;
}

export interface StudioSettings {
  id: "settings";
  timezone: string;
  /** Local times, HH:MM. Count sets how many a day. */
  longSlots: string[];
  shortSlots: string[];
  /** Keep this many days of approved videos ahead of the schedule. */
  bufferDays: number;
  updatedAt: string;
  updatedBy?: string;
}
