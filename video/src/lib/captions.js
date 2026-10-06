import { createTikTokStyleCaptions } from "@remotion/captions";

/**
 * Build word-level Caption[] (Remotion's Caption type) from a resolved script.
 * Words are spread across each scene's window by weight (length + pause after punctuation).
 * pageBreakAfter marks phrase ends; limits depend on aspect (characters per page).
 */
export function buildCaptions(video, { maxChars, maxWords }) {
  const caps = [];
  for (const scene of video.scenes) {
    const vo = (scene.voiceover || "").trim();
    if (!vo) continue;
    const words = vo.split(/\s+/);
    const lead = Math.min(0.35, scene.durationSec * 0.05);
    const tail = Math.min(0.5, scene.durationSec * 0.07);
    const start = scene.startSec + lead;
    const end = scene.startSec + scene.durationSec - tail;
    const weights = words.map((w) => w.length + 2 + (/[.?!]$/.test(w) ? 5 : /[,;:]$/.test(w) ? 2.5 : 0));
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    let phraseChars = 0, phraseWords = 0;
    words.forEach((w, i) => {
      const s = start + ((end - start) * acc) / total;
      acc += weights[i];
      const e = start + ((end - start) * acc) / total;
      phraseChars += w.length + 1;
      phraseWords += 1;
      const next = words[i + 1];
      const sentenceEnd = /[.?!]$/.test(w);
      const comma = /[,;:]$/.test(w) && phraseWords >= 3;
      const STOP = /^(the|a|an|of|to|and|or|by|for|in|on|with|your|you|is|that|it|at|as|from|than|but|if|not|be|are|can|will|who|their|our)$/i;
      const hardOver = next && (phraseChars + next.length + 1 > maxChars + 14 || phraseWords >= maxWords + 3);
      const softOver = next && (phraseChars + next.length + 1 > maxChars || phraseWords >= maxWords);
      const nextEndsClause = next && /[.?!,;:]$/.test(next);
      const wouldOverflow = hardOver || (softOver && !nextEndsClause && !STOP.test(w.replace(/[^\w']/g, "")));
      const last = i === words.length - 1;
      const brk = last || sentenceEnd || comma || wouldOverflow;
      caps.push({
        text: (i === 0 || caps.length === 0 ? "" : " ") + w,
        startMs: Math.round(s * 1000),
        endMs: Math.round(e * 1000),
        timestampMs: Math.round(((s + e) / 2) * 1000),
        confidence: null,
        ...(brk ? { pageBreakAfter: true } : {}),
      });
      if (brk) { phraseChars = 0; phraseWords = 0; }
    });
  }
  return caps;
}

/** Pages for display: [{ startMs, endMs, tokens:[{text,fromMs,toMs}] }] */
export function buildPages(video, limits) {
  const caps = buildCaptions(video, limits);
  const { pages } = createTikTokStyleCaptions({ captions: caps, combineTokensWithinMilliseconds: 600000 });
  return pages.map((p, i) => {
    const nextStart = pages[i + 1]?.startMs ?? Infinity;
    const lastTok = p.tokens[p.tokens.length - 1];
    // hold the page until the next one starts, but never more than 600 ms past its last word
    const endMs = Math.min(nextStart, lastTok.toMs + 600);
    return { text: p.text.trim(), startMs: p.startMs, endMs, tokens: p.tokens };
  });
}

export const HORIZONTAL_LIMITS = { maxChars: 46, maxWords: 9 };
export const VERTICAL_LIMITS = { maxChars: 36, maxWords: 6 };

const pad = (n, l = 2) => String(n).padStart(l, "0");
export function vttTime(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

export function toVtt(pages) {
  const cues = pages.map((p, i) => `${i + 1}\n${vttTime(p.startMs)} --> ${vttTime(p.endMs)}\n${p.text}\n`);
  return "WEBVTT\n\n" + cues.join("\n");
}
