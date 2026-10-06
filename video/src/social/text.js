export const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Shorten at a sentence boundary under `max` chars; never cut mid-word. */
export function shorten(text, max = 280) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  // do not treat "U.S." (or e.g./i.e.) as a sentence end
  const sentences = (t.replace(/\b(U)\.(S)\./g, "$1\u0001$2\u0001").replace(/\b(e)\.(g)\.|\b(i)\.(e)\./g, (m) => m.replace(/\./g, "\u0001")).match(/[^.!?]+[.!?]+(\s|$)/g) ?? [t]).map((x) => x.replace(/\u0001/g, "."));
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  // first sentence alone is too long: cut at a word boundary, prefer a clause break
  const cut = t.slice(0, max);
  const clause = Math.max(cut.lastIndexOf("; "), cut.lastIndexOf(", "));
  const base = clause > max * 0.5 ? cut.slice(0, clause) : cut.slice(0, cut.lastIndexOf(" "));
  return base.replace(/[\s,;:(-]+$/, "") + "…";
}

const words = (s) => s.split(/\s+/).filter(Boolean);
export const wordCount = (s) => words(s).length;

/** Break text into caption-sized phrases at punctuation, merging tiny bits and halving long ones. */
export function phrases(text, maxWords = 7, minWords = 3) {
  const raw = text.match(/[^,;:.!?—]+[,;:.!?—]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const merged = [];
  for (const p of raw) {
    const last = merged[merged.length - 1];
    if (last && (wordCount(p) < minWords || wordCount(last) < minWords) && wordCount(last) + wordCount(p) <= maxWords + 2) merged[merged.length - 1] = `${last} ${p}`;
    else merged.push(p);
  }
  const out = [];
  const split = (p) => {
    const w = words(p);
    if (w.length <= maxWords + 1) return out.push(p);
    const mid = Math.ceil(w.length / Math.ceil(w.length / maxWords));
    out.push(w.slice(0, mid).join(" "));
    split(w.slice(mid).join(" "));
  };
  merged.forEach(split);
  return out;
}

