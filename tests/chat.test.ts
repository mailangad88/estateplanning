import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOOK_TOPICS, parseBookParams } from "@/lib/book";
import {
  CHAT_DISCLAIMER,
  CHAT_TOPICS,
  chatAnswers,
  chatBookHref,
  chatCaptureResult,
  chatHiddenOn,
  coveredList,
  isCovered,
  matchState,
  searchTerms,
  plainExcerpt,
  topicForText,
} from "@/lib/chat";
import { DECISIONS } from "@/config/decisions";
import { TOOLS } from "@/config/tools";
import { leadSubmissionSchema } from "@/lib/lead";
import { scoreLead, segmentTags, toolTags } from "@/lib/scoring";

const root = process.cwd();

/** True when an internal href resolves to a page that exists in this repo. */
function routeExists(href: string): boolean {
  const p = href.split(/[?#]/)[0].replace(/^\//, "");
  const [first, second, third] = p.split("/");
  if (first === "tools" && second) return TOOLS.some((t) => t.slug === second);
  if (first === "decide" && second) return DECISIONS.some((d) => d.slug === second);
  if (first === "learn" && second && third) return fs.existsSync(path.join(root, "content/learn", second, `${third}.md`));
  if (first === "life-events" && second) return fs.existsSync(path.join(root, "content/life-events", `${second}.md`));
  return fs.existsSync(path.join(root, "src/app", p, "page.tsx"));
}

describe("chat topics", () => {
  it("use booking topic ids so the handoff link carries the topic", () => {
    const ids = new Set(BOOK_TOPICS.map((t) => t.id));
    for (const t of CHAT_TOPICS) expect(ids.has(t.id), t.id).toBe(true);
  });

  it("only link to pages that exist", () => {
    for (const t of CHAT_TOPICS) for (const l of t.links) expect(routeExists(l.href), `${t.id}: ${l.href}`).toBe(true);
    expect(routeExists("/not-in-your-state")).toBe(true);
    expect(routeExists("/book")).toBe(true);
  });

  it("never promise outcomes or give advice in canned replies", () => {
    for (const t of CHAT_TOPICS) expect(t.reply).not.toMatch(/\b(guarantee|you should|you must|best attorney|specialist|expert)\b/i);
  });
});

describe("topicForText", () => {
  it("matches typed questions to a topic", () => {
    expect(topicForText("Do I need a living trust for my house?")?.id).toBe("trust");
    expect(topicForText("who should be guardian of my kids")?.id).toBe("kids");
    expect(topicForText("how do I get power of attorney")?.id).toBe("poa");
  });

  it("puts death-related questions on the gentle topic even when other words match", () => {
    expect(topicForText("my dad died and left a will, what now?")?.id).toBe("probate");
    expect(topicForText("Mom passed away last week")?.id).toBe("probate");
  });

  it("does not treat 'estate planning' as a death", () => {
    expect(topicForText("how much does estate planning cost")?.id).not.toBe("probate");
  });

  it("returns null for nothing it recognises", () => {
    expect(topicForText("hello")).toBeNull();
  });
});

describe("state coverage", () => {
  it("checks the served list and names it in plain words", () => {
    expect(isCovered("il", ["IL", "NJ"])).toBe(true);
    expect(isCovered("TX", ["IL", "NJ"])).toBe(false);
    expect(isCovered(null, ["IL"])).toBe(false);
    expect(coveredList(["IL", "NJ"])).toBe("Illinois and New Jersey");
    expect(coveredList(["IL"])).toBe("Illinois");
  });
});

describe("typed input", () => {
  it("reads a state from a code or a name", () => {
    expect(matchState("nj")).toBe("NJ");
    expect(matchState("I live in Illinois")).toBe("IL");
    expect(matchState("West Virginia")).toBe("WV");
    expect(matchState("Texas")).toBe("TX");
    expect(matchState("what is a will")).toBeNull();
  });

  it("turns a question into search keywords", () => {
    expect(searchTerms("Do we have to go through probate?")).toBe("go through probate");
    expect(searchTerms("???")).toBe("");
    expect(searchTerms("what is a will")).toBe("will");
  });
});

describe("handoff to /book", () => {
  it("tags bookings with from=chat and the topic", () => {
    expect(parseBookParams(chatBookHref("trust").split("?")[1])).toEqual({ from: "chat", topic: "trust" });
    expect(chatBookHref(null)).toBe("/book?from=chat");
  });
});

describe("chat leads", () => {
  const base = {
    firstName: "Ana",
    email: "ana@example.com",
    state: "IL",
    smsConsent: false,
    acknowledgedNoRelationship: true,
  };

  it("accept email only (phone optional) and still require the notice", () => {
    const capture = { tool: "chat", result: chatCaptureResult({ topic: "will", state: "IL", question: "x", steps: 3, page: "/wills" }) };
    expect(leadSubmissionSchema.safeParse({ ...base, capture }).success).toBe(true);
    expect(leadSubmissionSchema.safeParse({ ...base, capture, acknowledgedNoRelationship: false }).success).toBe(false);
    // Texting still needs a phone number.
    expect(leadSubmissionSchema.safeParse({ ...base, capture, smsConsent: true }).success).toBe(false);
  });

  it("are scored as a direct request", () => {
    const r = scoreLead({ state: "IL", servedStates: ["IL", "NJ"], answers: chatAnswers("will"), smsConsent: false, capture: { tool: "chat" } });
    expect(r.tier).toBe("hot");
    expect(r.components.some((c) => c.key === "intent:chat")).toBe(true);
  });

  it("send grieving families to the grief track", () => {
    const result = chatCaptureResult({ topic: "probate", state: "IL", question: null, steps: 2, page: "/" });
    expect(result.mode).toBe("heir");
    expect(toolTags({ tool: "chat", result })).toContain("estate_administration");
    expect(segmentTags(chatAnswers("probate"))).toContain("estate_administration");
  });

  it("keep the summary small", () => {
    const r = chatCaptureResult({ topic: null, state: null, question: "q".repeat(900), steps: 1, page: "/x".repeat(200) });
    expect(String(r.question).length).toBe(500);
    expect(String(r.page).length).toBe(200);
    expect(r.topic).toBeUndefined();
  });
});

describe("chat placement and copy", () => {
  it("stays off staff, client and booking pages", () => {
    for (const p of ["/portal", "/portal/leads", "/admin/studio", "/client", "/book", "/plan-finder", "/intake", "/free/x/view"]) expect(chatHiddenOn(p), p).toBe(true);
    for (const p of ["/", "/wills", "/learn/probate/x", "/pricing", "/booking-tips"]) expect(chatHiddenOn(p), p).toBe(false);
  });

  it("shows the referral disclaimer", () => {
    expect(CHAT_DISCLAIMER).toMatch(/educational purposes only/);
    expect(CHAT_DISCLAIMER).toMatch(/does not constitute legal advice/);
    expect(CHAT_DISCLAIMER).toMatch(/attorney-client relationship/);
    expect(CHAT_DISCLAIMER).toMatch(/referral website/);
  });

  it("strips markup from search excerpts", () => {
    expect(plainExcerpt("A <mark>trust</mark> &amp; a will")).toBe("A trust & a will");
    expect(plainExcerpt("x".repeat(300), 20)).toHaveLength(20);
  });

  it("is mounted in the root layout", () => {
    const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/<SiteChat /);
  });
});
