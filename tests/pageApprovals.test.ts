import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAuditChain } from "@/server/audit/log";
import { can, ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import {
  approvePages,
  exportPageApprovals,
  fileHash,
  listPageQueue,
  previewPageEdit,
  readPageForEdit,
  repoPages,
  type PageSource,
} from "@/server/content/pageApprovals";
import { fileFor, type ReviewItem, type RiskTier } from "@/lib/review-queue";
import { applyEdits, editableParts, flagFor, withReviewFlags } from "@/lib/review-flags";
import type { Actor, Role } from "@/server/types";

const NOW = new Date("2026-10-06T12:00:00Z");
const actor = (role: Role, userId = `u-${role}`, mfa = true): Actor => ({ userId, role, firmId: "f1", lawyerId: "l1", mfa });
const ROLES: Role[] = ["platform_admin", "attorney", "firm_admin", "paralegal", "intake", "marketing", "client"];

const GUIDE = (title: string) => `---\ntitle: "${title}"\ndescription: "d"\nupdated: 2026-10-06\nreviewed: false\nrelated: [a, b]\n---\n\nBody of ${title}.\n`;
const STATE = (name: string) => `---\nstate: "${name}"\ntitle: "Estate planning in ${name}"\nupdated: "2026-10-06"\nfacts:\n  willSigning: "Two witnesses."\n---\n\n${name} body.\n`;

let root: string;
let source: PageSource;
let items: ReviewItem[];

function page(p: string, tier: RiskTier, kind: ReviewItem["kind"] = "guide", reviewed = false, reasons: string[] = []): ReviewItem {
  return { path: p, title: p.split("/").pop()!, kind, reviewed, words: 900, score: 50, tier, reasons };
}

function write(p: string, text: string) {
  const full = path.join(root, fileFor(p));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}
const read = (p: string) => fs.readFileSync(path.join(root, fileFor(p)), "utf8");
const hash = (p: string) => fileHash(root, fileFor(p))!;
const pick = (...paths: string[]) => paths.map((p) => ({ path: p, contentHash: hash(p) }));

async function seedUser(db: Db, a: Actor, name: string) {
  await db.users.insert({ id: a.userId, email: `${a.userId}@x.test`, name, role: a.role, active: true });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "page-approvals-"));
  items = [
    page("/guides/what-is-a-will", "low", "guide", false, ["reads 80% AI-written: needs a rewrite in the attorney's words"]),
    page("/guides/what-is-a-trust", "low"),
    page("/guides/already-live", "low", "guide", true),
    ...[1, 2, 3, 4, 5, 6].map((i) => page(`/guides/process-${i}`, "medium")),
    page("/estate-planning/nevada", "high", "state"),
    page("/estate-planning/ohio", "high", "state"),
  ];
  for (const i of items) {
    if (i.kind === "state") write(i.path, STATE(i.title));
    else write(i.path, GUIDE(i.title).replace("reviewed: false", i.reviewed ? "reviewed: true" : "reviewed: false"));
  }
  source = { root, items: () => items };
});

beforeEach(() => {
  vi.stubEnv("GITHUB_CONTENT_TOKEN", "");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("permissions", () => {
  it("only attorneys and platform admins can approve pages", () => {
    expect(ROLES.filter((r) => can(actor(r), "approve_pages"))).toEqual(["platform_admin", "attorney"]);
  });

  it("refuses marketing and every other role without writing or auditing", async () => {
    const db = createMemoryDb();
    for (const role of ["marketing", "intake", "firm_admin", "paralegal", "client"] as const) {
      const input = { pages: pick("/guides/what-is-a-will"), confirmed: true };
      await expect(approvePages(db, actor(role), input, source, NOW), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listPageQueue(db, actor(role), source), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(exportPageApprovals(db, actor(role), source), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.pageApprovals.list()).toEqual([]);
    expect(await db.audit.list()).toEqual([]);
  });

  it("requires two-step sign-in in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const db = createMemoryDb();
    const noMfa = actor("attorney", "u-attorney", false);
    await expect(approvePages(db, noMfa, { pages: pick("/guides/what-is-a-will"), confirmed: true }, source, NOW)).rejects.toThrow(/Two-step/);
    await expect(listPageQueue(db, noMfa, source)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.pageApprovals.list()).toEqual([]);
    await approvePages(db, actor("attorney"), { pages: pick("/guides/what-is-a-will"), confirmed: true }, source, NOW);
    expect((await db.pageApprovals.list()).length).toBe(1);
  });
});

describe("approving", () => {
  it("approves a low-risk batch as one audited batch, bound to each file's hash", async () => {
    const db = createMemoryDb();
    const a = actor("attorney");
    await seedUser(db, a, "Avery Demo");
    const res = await approvePages(db, a, { pages: pick("/guides/what-is-a-will", "/guides/what-is-a-trust"), confirmed: true, note: " skimmed " }, source, NOW);
    expect(res.tier).toBe("low");
    expect(res.approvals.map((x) => [x.path, x.contentHash, x.batchId, x.approverName, x.approverRole, x.note])).toEqual([
      ["/guides/what-is-a-will", hash("/guides/what-is-a-will"), res.batchId, "Avery Demo", "attorney", "skimmed"],
      ["/guides/what-is-a-trust", hash("/guides/what-is-a-trust"), res.batchId, "Avery Demo", "attorney", "skimmed"],
    ]);
    const events = await db.audit.list();
    expect(events.map((e) => [e.action, e.resourceId, e.detail])).toEqual([
      ["page.approve", res.batchId, { count: 2, batchId: res.batchId, tier: "low", paths: ["/guides/what-is-a-will", "/guides/what-is-a-trust"], edited: false, pullRequest: null }],
    ]);
    expect(verifyAuditChain(events).ok).toBe(true);

    const q = await listPageQueue(db, a, source);
    expect(q.counts.status).toEqual({ published: 1, approved: 2, changed: 0, pending: 8 });
    expect(q.batches.low).toEqual([]);
    expect(q.rows.find((r) => r.path === "/guides/what-is-a-will")!.aiFlag).toMatch(/AI-written/);
    // approving the same version twice is refused
    await expect(approvePages(db, a, { pages: pick("/guides/what-is-a-will"), confirmed: true }, source, NOW)).rejects.toThrow(/already approved/);
  });

  it("needs the explicit 'I read each page' confirmation", async () => {
    const db = createMemoryDb();
    await expect(approvePages(db, actor("attorney"), { pages: pick("/guides/what-is-a-will"), confirmed: false }, source, NOW)).rejects.toThrow(/Confirm/);
    expect(await db.pageApprovals.list()).toEqual([]);
  });

  it("refuses a stale hash, and shows a page edited after approval as changed", async () => {
    const db = createMemoryDb();
    const a = actor("attorney");
    const shown = pick("/guides/what-is-a-will");
    write("/guides/what-is-a-will", GUIDE("what-is-a-will") + "\nA new paragraph.\n");
    await expect(approvePages(db, a, { pages: shown, confirmed: true }, source, NOW)).rejects.toThrow(/changed while you were reviewing/);
    expect(await db.pageApprovals.list()).toEqual([]);

    await approvePages(db, a, { pages: pick("/guides/what-is-a-will"), confirmed: true }, source, NOW);
    write("/guides/what-is-a-will", GUIDE("what-is-a-will") + "\nEdited again.\n");
    const q = await listPageQueue(db, a, source);
    const row = q.rows.find((r) => r.path === "/guides/what-is-a-will")!;
    expect(row.status).toBe("changed");
    expect(row.approval).toBeUndefined();
    expect(q.batches.low[0][0].path).toBe("/guides/what-is-a-will"); // changed pages come first
    await approvePages(db, a, { pages: pick("/guides/what-is-a-will"), confirmed: true }, source, NOW);
    expect((await listPageQueue(db, a, source)).rows.find((r) => r.path === "/guides/what-is-a-will")!.status).toBe("approved");
  });

  it("refuses a high-risk batch, a medium batch, mixed tiers and published pages, server side", async () => {
    const db = createMemoryDb();
    const a = actor("attorney");
    await expect(approvePages(db, a, { pages: pick("/estate-planning/nevada", "/estate-planning/ohio"), confirmed: true }, source, NOW)).rejects.toThrow(/one at a time/);
    const six = [1, 2, 3, 4, 5, 6].map((i) => `/guides/process-${i}`);
    await expect(approvePages(db, a, { pages: pick(...six.slice(0, 2)), confirmed: true }, source, NOW)).rejects.toThrow(/Medium-risk pages are approved one at a time/);
    const lows = Array.from({ length: 21 }, (_, i) => `/guides/what-is-${i}`);
    for (const p of lows) { items.push(page(p, "low")); write(p, GUIDE(p)); }
    await expect(approvePages(db, a, { pages: pick(...lows), confirmed: true }, source, NOW)).rejects.toThrow(/At most 20/);
    await expect(approvePages(db, a, { pages: pick("/guides/what-is-a-will", "/guides/process-1"), confirmed: true }, source, NOW)).rejects.toThrow(/one risk tier/);
    await expect(approvePages(db, a, { pages: pick("/guides/already-live"), confirmed: true }, source, NOW)).rejects.toThrow(/already published/);
    await expect(approvePages(db, a, { pages: [{ path: "/guides/nope", contentHash: "x" }], confirmed: true }, source, NOW)).rejects.toThrow(/Unknown page/);
    expect(await db.pageApprovals.list()).toEqual([]);
    expect(await db.audit.list()).toEqual([]);

    expect((await approvePages(db, a, { pages: pick("/estate-planning/nevada"), confirmed: true }, source, NOW)).approvals).toHaveLength(1);
    expect((await approvePages(db, a, { pages: pick(six[0]), confirmed: true }, source, NOW)).approvals).toHaveLength(1);
    const q = await listPageQueue(db, a, source);
    expect(q.batches.high.map((b) => b.map((r) => r.path))).toEqual([["/estate-planning/ohio"]]);
  });
});

describe("scripts/apply-page-approvals.mts", () => {
  const repo = path.join(__dirname, "..");
  const run = (from: string, ...extra: string[]) =>
    JSON.parse(execFileSync(path.join(repo, "node_modules", ".bin", "tsx"), [path.join(repo, "scripts", "apply-page-approvals.mts"), "--root", root, "--from", from, "--json", ...extra], { encoding: "utf8", cwd: repo }));

  it("dry-run reports the right flag without writing; a real run writes it and refuses changed or non-attorney pages", async () => {
    const db = createMemoryDb();
    const a = actor("attorney");
    const admin = actor("platform_admin");
    await seedUser(db, a, "Avery Demo");
    await approvePages(db, a, { pages: pick("/guides/what-is-a-will", "/guides/what-is-a-trust"), confirmed: true }, source, NOW);
    await approvePages(db, a, { pages: pick("/estate-planning/nevada"), confirmed: true }, source, NOW);
    await approvePages(db, admin, { pages: pick("/estate-planning/ohio"), confirmed: true }, source, NOW);
    write("/guides/what-is-a-trust", GUIDE("what-is-a-trust") + "\nEdited after approval.\n");
    const exported = await exportPageApprovals(db, a, source, NOW);
    expect(exported.approvals.find((x) => x.path === "/guides/what-is-a-trust")!.matchesCurrentFile).toBe(false);
    const file = path.join(root, "approvals.json");
    fs.writeFileSync(file, JSON.stringify(exported));

    const before = read("/guides/what-is-a-will");
    const dry = run(file, "--dry-run");
    expect(dry.applied.map((x: { file: string; flag: string }) => [x.file, x.flag])).toEqual([
      ["content/guides/what-is-a-will.md", "reviewed: true"],
      ["content/states/nevada.md", "review: approved"],
    ]);
    expect(dry.refused).toEqual([{ path: "/guides/what-is-a-trust", file: "content/guides/what-is-a-trust.md", reason: expect.stringMatching(/changed since/) }]);
    expect(dry.ignored).toEqual([{ path: "/estate-planning/ohio", reason: expect.stringMatching(/not an attorney/) }]);
    expect(read("/guides/what-is-a-will")).toBe(before);

    const real = run(file);
    expect(real.applied).toHaveLength(2);
    const will = read("/guides/what-is-a-will");
    expect(will).toContain("reviewed: true\n");
    expect(will).not.toContain("reviewed: false");
    expect(will).toContain('reviewedBy: "Avery Demo"\n');
    expect(will).toContain("lastReviewed: 2026-10-06\n");
    expect(will.replace(/reviewed: true\nrelated: \[a, b\]\nreviewedBy: "Avery Demo"\nlastReviewed: 2026-10-06\n/, "reviewed: false\nrelated: [a, b]\n")).toBe(before);
    const nevada = read("/estate-planning/nevada");
    expect(nevada).toMatch(/willSigning: "Two witnesses."\nreview: approved\nreviewedBy: "Avery Demo"\nlastReviewed: 2026-10-06\n---\n/);
    expect(read("/guides/what-is-a-trust")).toContain("reviewed: false");
    expect(read("/estate-planning/ohio")).not.toContain("review:");

    // A second run finds them published and writes nothing new.
    const again = run(file);
    expect(again.applied).toEqual([]);
    expect(again.alreadyPublished.map((x: { file: string }) => x.file)).toEqual(["content/guides/what-is-a-will.md", "content/states/nevada.md"]);
  });

  it("never writes a flag without a matching approval record", () => {
    const file = path.join(root, "forged.json");
    fs.writeFileSync(file, JSON.stringify({ approvals: [
      { id: "x", path: "/guides/what-is-a-will", file: "content/guides/what-is-a-will.md", contentHash: "0".repeat(64), approverRole: "attorney", approverName: "X", approvedAt: NOW.toISOString() },
      { id: "y", path: "/guides/what-is-a-trust", file: "content/states/nevada.md", contentHash: hash("/estate-planning/nevada"), approverRole: "attorney", approverName: "X", approvedAt: NOW.toISOString() },
      { id: "z", path: "/guides/x", file: "../etc/passwd.md", contentHash: "0", approverRole: "attorney", approvedAt: NOW.toISOString() },
      { id: "w", path: "/estate-planning/ohio", file: "content/states/ohio.md", contentHash: hash("/estate-planning/ohio"), approverRole: "attorney", approverName: "X", approvedAt: NOW.toISOString(), prUrl: "https://github.com/o/r/pull/1" },
    ] }));
    const res = run(file);
    expect(res.applied).toEqual([]);
    expect(res.refused).toHaveLength(3);
    expect(res.ignored).toEqual([{ path: "/estate-planning/ohio", reason: expect.stringMatching(/pull request/) }]);
    expect(read("/estate-planning/ohio")).not.toContain("review:");
    expect(read("/guides/what-is-a-will")).toContain("reviewed: false");
    expect(read("/estate-planning/nevada")).not.toContain("review:");
  });
});

describe("repo pages", () => {
  it("every page in the review queue has a content file to hash", () => {
    const missing = repoPages.items().filter((i) => !fileHash(repoPages.root, fileFor(i.path)));
    expect(missing.map((i) => i.path)).toEqual([]);
  });
});

describe("pull requests through the GitHub API (mocked fetch)", () => {
  const GH = { token: "t0k", repo: "mailangad88/estateplanning", base: "main", api: "https://api.github.test" };
  interface Call { method: string; route: string; auth: string; body?: Record<string, unknown> }

  /** A fake GitHub that serves the files in the temp root as the base branch. */
  function fakeGithub(overrides: Record<string, string> = {}) {
    const calls: Call[] = [];
    const impl = (async (url: string | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const route = String(url).replace(`${GH.api}/repos/${GH.repo}`, "");
      const auth = String((init?.headers as Record<string, string>)?.authorization ?? "");
      calls.push({ method, route: route.split("?")[0], auth, body });
      const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
      if (method === "GET" && route === "/git/ref/heads/main") return json(200, { object: { sha: "base-sha" } });
      if (method === "GET" && route.startsWith("/contents/")) {
        const file = decodeURIComponent(route.slice("/contents/".length).split("?")[0]);
        const text = overrides[file] ?? fs.readFileSync(path.join(root, file), "utf8");
        return json(200, { content: Buffer.from(text).toString("base64"), encoding: "base64" });
      }
      if (method === "GET" && route === "/git/commits/base-sha") return json(200, { tree: { sha: "base-tree" } });
      if (method === "POST" && route === "/git/trees") return json(201, { sha: "new-tree" });
      if (method === "POST" && route === "/git/commits") return json(201, { sha: "new-commit" });
      if (method === "POST" && route === "/git/refs") return json(201, {});
      if (method === "POST" && route === "/pulls") return json(201, { html_url: "https://github.com/mailangad88/estateplanning/pull/77", number: 77 });
      return json(404, { message: `unexpected ${method} ${route}` });
    }) as typeof fetch;
    return { calls, impl };
  }
  const bodyOf = <T,>(calls: Call[], route: string) => calls.find((c) => c.route === route)!.body as T;

  it("opens one PR per approval with the flag, the attorney as author and the approval ids, and never merges", async () => {
    const db = createMemoryDb();
    const a = actor("attorney");
    await seedUser(db, a, "Avery Demo");
    const gh = fakeGithub();
    const before = read("/guides/what-is-a-will");
    const res = await approvePages(db, a, { pages: pick("/guides/what-is-a-will", "/guides/what-is-a-trust"), confirmed: true, note: "Checked both" }, source, NOW, { github: GH, fetch: gh.impl });
    expect(res.pullRequest).toEqual({ url: "https://github.com/mailangad88/estateplanning/pull/77", number: 77, branch: `page-approval/${res.batchId}` });
    expect(res.approvals.every((x) => x.prUrl === res.pullRequest!.url)).toBe(true);
    expect(gh.calls.map((c) => `${c.method} ${c.route}`)).toEqual([
      "GET /git/ref/heads/main",
      "GET /contents/content/guides/what-is-a-will.md",
      "GET /contents/content/guides/what-is-a-trust.md",
      "GET /git/commits/base-sha",
      "POST /git/trees",
      "POST /git/commits",
      "POST /git/refs",
      "POST /pulls",
    ]);
    expect(gh.calls.every((c) => c.auth === "Bearer t0k" && !/merge/.test(c.route))).toBe(true);
    const tree = bodyOf<{ base_tree: string; tree: { path: string; content: string }[] }>(gh.calls, "/git/trees");
    expect(tree.base_tree).toBe("base-tree");
    expect(tree.tree.map((t) => t.path)).toEqual(["content/guides/what-is-a-will.md", "content/guides/what-is-a-trust.md"]);
    expect(tree.tree[0].content).toBe(
      before.replace("reviewed: false", "reviewed: true").replace("related: [a, b]\n", 'related: [a, b]\nreviewedBy: "Avery Demo"\nlastReviewed: 2026-10-06\n'),
    );
    const commit = bodyOf<{ message: string; author: { name: string; email: string }; parents: string[] }>(gh.calls, "/git/commits");
    expect(commit.author).toMatchObject({ name: "Avery Demo", email: "u-attorney@x.test" });
    expect(commit.parents).toEqual(["base-sha"]);
    for (const x of res.approvals) expect(commit.message).toContain(x.id);
    expect(commit.message).toContain("Approved by Avery Demo");
    const pr = bodyOf<{ title: string; body: string; base: string; head: string }>(gh.calls, "/pulls");
    expect(pr.base).toBe("main");
    expect(pr.head).toBe(res.pullRequest!.branch);
    expect(pr.body).toMatch(/Approved in the attorney portal/);
    expect(pr.body).toContain("Risk tier: low");
    expect(pr.body).toContain("Attorney's note: Checked both");
    expect(pr.body).toContain("/guides/what-is-a-will");
    expect(pr.body).toContain("/guides/what-is-a-trust");
    expect(pr.body).toMatch(/not and will not be merged automatically/);
    // this checkout is untouched: the change lives only in the PR
    expect(read("/guides/what-is-a-will")).toBe(before);
    expect((await db.audit.list())[0].detail).toMatchObject({ pullRequest: res.pullRequest!.url, edited: false });
  });

  it("refuses, and records nothing, when the base branch has a different version of the file", async () => {
    const db = createMemoryDb();
    const gh = fakeGithub({ "content/states/nevada.md": `${STATE("nevada")}\nnewer on main\n` });
    await expect(
      approvePages(db, actor("attorney"), { pages: pick("/estate-planning/nevada"), confirmed: true }, source, NOW, { github: GH, fetch: gh.impl }),
    ).rejects.toThrow(/not the version you reviewed/);
    expect(gh.calls.some((c) => c.method === "POST")).toBe(false);
    expect(await db.pageApprovals.list()).toEqual([]);
    expect(await db.audit.list()).toEqual([]);
  });

  it("a platform admin's approval is recorded but opens no PR", async () => {
    const db = createMemoryDb();
    const gh = fakeGithub();
    const res = await approvePages(db, actor("platform_admin"), { pages: pick("/estate-planning/nevada"), confirmed: true }, source, NOW, { github: GH, fetch: gh.impl });
    expect(res.pullRequest).toBeNull();
    expect(gh.calls).toEqual([]);
    expect(res.approvals).toHaveLength(1);
  });

  it("approve with my edits: the PR carries the edited file and the approval hash is the edited file's", async () => {
    const db = createMemoryDb();
    const a = actor("attorney");
    await seedUser(db, a, "Avery Demo");
    const shown = await readPageForEdit(db, a, "/estate-planning/nevada", source);
    expect(shown).toMatchObject({ title: "Estate planning in nevada", hash: hash("/estate-planning/nevada") });
    const edits = { title: "Estate planning in Nevada", description: "Nevada wills and trusts.", body: "\nNevada body, checked against NRS 133.040.\n" };
    expect((await previewPageEdit(a, "/estate-planning/nevada", edits.body, source)).html).toContain("NRS 133.040");
    const gh = fakeGithub();
    const res = await approvePages(db, a, { pages: pick("/estate-planning/nevada"), confirmed: true, edits }, source, NOW, { github: GH, fetch: gh.impl });
    const sent = bodyOf<{ tree: { content: string }[] }>(gh.calls, "/git/trees").tree[0].content;
    expect(sent).toContain('title: "Estate planning in Nevada"');
    expect(sent).toContain('description: "Nevada wills and trusts."');
    expect(sent).toContain('willSigning: "Two witnesses."'); // other frontmatter untouched
    expect(sent).toContain("review: approved");
    expect(sent).toMatch(/---\n\nNevada body, checked against NRS 133\.040\.\n$/);
    const [rec] = res.approvals;
    expect(rec.editedFromHash).toBe(hash("/estate-planning/nevada"));
    const editedFile = sent.replace('review: approved\nreviewedBy: "Avery Demo"\nlastReviewed: 2026-10-06\n', "");
    expect(rec.contentHash).toBe(createHash("sha256").update(editedFile).digest("hex"));
    expect(bodyOf<{ body: string }>(gh.calls, "/pulls").body).toContain("edited by the attorney in the portal");
    // the deployed page still reads the old text and shows as approved: its edit waits in the PR
    const q = await listPageQueue(db, a, source, { github: GH });
    expect(q.rows.find((r) => r.path === "/estate-planning/nevada")!.status).toBe("approved");
    expect(q.opensPullRequests).toBe(true);
  });

  it("edits need GitHub publishing and a single page", async () => {
    const db = createMemoryDb();
    const edits = { title: "T", description: "", body: "New body" };
    await expect(
      approvePages(db, actor("attorney"), { pages: pick("/estate-planning/nevada"), confirmed: true, edits }, source, NOW, { github: null }),
    ).rejects.toThrow(/GITHUB_CONTENT_TOKEN/);
    await expect(
      approvePages(db, actor("attorney"), { pages: pick("/guides/what-is-a-will", "/guides/what-is-a-trust"), confirmed: true, edits }, source, NOW, { github: GH, fetch: fakeGithub().impl }),
    ).rejects.toThrow(/one page at a time/);
    expect(await db.pageApprovals.list()).toEqual([]);
  });
});

describe("review flag edits", () => {
  const text = `---\ntitle: "Old"\ndescription: >-\n  A folded\n  description.\nfacts:\n  a: "b"\nreview: pending\n---\n\nBody.\n`;

  it("sets the flag and record fields and keeps every other line", () => {
    const flagged = withReviewFlags(text, flagFor("content/learn/x/y.md")!, { name: "Avery Demo", date: "2026-10-06T00:00:00Z" });
    expect(flagged).toBe(`---\ntitle: "Old"\ndescription: >-\n  A folded\n  description.\nfacts:\n  a: "b"\nreview: approved\nreviewedBy: "Avery Demo"\nlastReviewed: 2026-10-06\n---\n\nBody.\n`);
  });

  it("edits only the title, description and body", () => {
    expect(editableParts(text)).toEqual({ title: "Old", description: "A folded description.", body: "\nBody.\n" });
    expect(applyEdits(text, editableParts(text))).toBe(text);
    expect(applyEdits(text, { title: "New", description: "A folded description.", body: "\nBody.\n" })).toBe(text.replace('title: "Old"', 'title: "New"'));
    expect(applyEdits(text, { title: "Old", description: "Short", body: "\nBody.\n" })).toBe(`---\ntitle: "Old"\ndescription: "Short"\nfacts:\n  a: "b"\nreview: pending\n---\n\nBody.\n`);
    expect(() => applyEdits(text, { title: " ", description: "", body: "x" })).toThrow(/title/);
  });
});
