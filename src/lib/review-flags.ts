/**
 * Line-level frontmatter edits for the attorney's page approvals. Only the keys named here change; every other
 * line of the file stays byte for byte, so an approval commit's diff shows exactly what was approved.
 * Used by the portal (src/server/content/pageApprovals.ts) and by scripts/apply-page-approvals.mts.
 */

export interface ReviewFlag {
  key: "review" | "reviewed";
  value: "approved" | "true";
}

/** The flag a content file uses: `review: approved` for library and state pages, `reviewed: true` for the rest. */
export function flagFor(file: string): ReviewFlag | null {
  if (/^content\/(learn|states)\//.test(file)) return { key: "review", value: "approved" };
  if (/^content\/(guides|compare|blog|life-events)\//.test(file)) return { key: "reviewed", value: "true" };
  return null;
}

interface Split {
  /** Frontmatter lines, without the opening and closing `---`. */
  lines: string[];
  /** Everything after the closing `---` line, newline included. */
  rest: string;
}

export function splitFrontmatter(text: string): Split | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!m) return null;
  return { lines: m[1].split("\n"), rest: text.slice(m[0].length) };
}

export function joinFrontmatter(s: Split): string {
  return `---\n${s.lines.join("\n")}\n---\n${s.rest}`;
}

const keyRe = (key: string) => new RegExp(`^${key}:(\\s|$)`);

/** The raw scalar value of a top-level key, unquoted. */
export function readKey(s: Split, key: string): string | undefined {
  const line = s.lines.find((l) => keyRe(key).test(l));
  if (line === undefined) return undefined;
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

/** Sets a top-level key (replacing its line and any indented continuation lines), or appends it. */
export function setKey(s: Split, key: string, value: string): void {
  const i = s.lines.findIndex((l) => keyRe(key).test(l));
  const line = `${key}: ${value}`;
  if (i < 0) {
    s.lines.push(line);
    return;
  }
  let end = i + 1;
  while (end < s.lines.length && /^\s+\S/.test(s.lines[end])) end++;
  s.lines.splice(i, end - i, line);
}

export function isFlagged(text: string, flag: ReviewFlag): boolean {
  const s = splitFrontmatter(text);
  return !!s && readKey(s, flag.key) === flag.value;
}

const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

/** Adds the review flag plus `reviewedBy` and `lastReviewed`. Throws when the file has no frontmatter. */
export function withReviewFlags(text: string, flag: ReviewFlag, reviewer: { name: string; date: string }): string {
  const s = splitFrontmatter(text);
  if (!s) throw new Error("no frontmatter");
  setKey(s, flag.key, flag.value);
  setKey(s, "reviewedBy", JSON.stringify(oneLine(reviewer.name)));
  setKey(s, "lastReviewed", reviewer.date.slice(0, 10));
  return joinFrontmatter(s);
}

export interface EditableParts {
  title: string;
  description: string;
  body: string;
}

/** What the portal editor may change: the title, the description and the markdown body. */
export function editableParts(text: string): EditableParts {
  const s = splitFrontmatter(text);
  if (!s) return { title: "", description: "", body: text };
  return { title: readKey(s, "title") ?? "", description: readFoldedKey(s, "description"), body: s.rest };
}

/** Reads a scalar or a folded (`>-` / `|`) value as one string. */
function readFoldedKey(s: Split, key: string): string {
  const i = s.lines.findIndex((l) => keyRe(key).test(l));
  if (i < 0) return "";
  const head = s.lines[i].slice(key.length + 1).trim();
  if (!/^[>|][-+]?$/.test(head)) return readKey(s, key) ?? "";
  const out: string[] = [];
  for (let j = i + 1; j < s.lines.length && /^\s+\S/.test(s.lines[j]); j++) out.push(s.lines[j].trim());
  return out.join(" ");
}

/**
 * Applies the attorney's edits. Unchanged parts keep their original lines, so an edit to the body alone
 * does not reformat the frontmatter. Other frontmatter keys cannot be changed here.
 */
export function applyEdits(text: string, edits: EditableParts): string {
  const s = splitFrontmatter(text);
  if (!s) throw new Error("no frontmatter");
  const before = editableParts(text);
  const title = oneLine(edits.title);
  const description = oneLine(edits.description);
  if (!title) throw new Error("The title cannot be empty");
  if (title !== before.title) setKey(s, "title", JSON.stringify(title));
  if (description !== before.description) setKey(s, "description", JSON.stringify(description));
  let body = edits.body.replace(/\r\n?/g, "\n");
  if (body.trim() === "") throw new Error("The page body cannot be empty");
  if (!body.endsWith("\n")) body += "\n";
  if (body.trimEnd() !== before.body.trimEnd()) s.rest = body;
  return joinFrontmatter(s);
}
