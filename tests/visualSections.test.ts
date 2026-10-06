import { describe, expect, it } from "vitest";
import { planVisuals } from "@/lib/visual-sections";
import { parseMarker, PICKERS, TIMELINES } from "@/config/visual-kit";
import { WHAT_IF_SCENARIOS } from "@/config/what-if-scenarios";
import { diagramRegistry } from "@/components/visuals/diagrams/registry";

const section = (h: string, body = "<p>Some words about this.</p>") => `<h2 id="x">${h}</h2>${body}`;
const visuals = (segs: ReturnType<typeof planVisuals>) => segs.filter((s) => "visual" in s).map((s) => ("visual" in s ? s.visual : null));

describe("visual kit planner", () => {
  const html = `<p>Intro</p>${section("How probate works")}${section("What it costs")}${section("Which option is right for you")}${section("What if you wait")}${section("Getting help")}${section("Frequently asked questions")}`;

  it("gives every content section a visual, none in the intro or FAQ, with no repeats", () => {
    const v = visuals(planVisuals({ html, path: "/learn/probate/how-probate-works", title: "How probate works", downloads: ["probate-guide"], hasRelated: true }));
    expect(v).toHaveLength(5);
    expect(new Set(v.map((x) => JSON.stringify(x))).size).toBe(5);
    expect(v.map((x) => x!.type)).toContain("slider");
    expect(v.map((x) => x!.type)).toContain("picker");
  });

  it("keeps sensitive pages calm: no what-ifs, quizzes or cost sliders", () => {
    const v = visuals(planVisuals({ html, path: "/learn/after-a-death/first-steps-after-a-death", title: "First steps after a death", sensitive: true, downloads: ["x"], hasRelated: true }));
    expect(v.every((x) => !["whatif", "whatif-strip", "picker", "slider"].includes(x!.type))).toBe(true);
  });

  it("places writer markers where they are and counts them as the section's visual", () => {
    const body = `${section("Funding", "<p>a</p><!-- visual: whatif id=unfunded-trust --><p>b</p>")}`;
    const segs = planVisuals({ html: body, path: "/learn/trusts/funding", title: "Funding a trust" });
    expect(visuals(segs)).toEqual([{ type: "whatif", id: "unfunded-trust" }]);
    expect(segs[segs.length - 1]).toEqual({ html: "<p>b</p>" });
  });

  it("treats numbered lists as a timeline and tables as already visual", () => {
    const segs = planVisuals({ html: section("Steps", "<ol><li>a</li><li>b</li><li>c</li></ol>") + section("Compare", '<div class="table-wrap"><table></table></div>'), path: "/x", title: "x" });
    expect(visuals(segs)).toHaveLength(0);
    expect(segs.some((s) => "html" in s && s.html.includes('<ol class="is-timeline">'))).toBe(true);
  });

  it("uses frontmatter visuals for the named section", () => {
    const v = visuals(planVisuals({ html: section("How probate works") + section("Costs"), path: "/x", title: "x", explicit: [{ section: "costs", type: "timeline", id: "after-a-death" }] }));
    expect(v).toEqual([{ type: "timeline", id: "after-a-death" }]);
  });

  it("skips diagrams already shown at the top of the page", () => {
    const v = visuals(planVisuals({ html: section("How probate works"), path: "/guides/how-probate-works", title: "How probate works", excludeDiagrams: ["ProbateTimeline"] }));
    expect(v).not.toContainEqual({ type: "diagram", name: "ProbateTimeline" });
  });
});

describe("visual kit data", () => {
  it("parses markers and rejects unknown ones", () => {
    expect(parseMarker("picker", " id=guardian")).toEqual({ type: "picker", id: "guardian" });
    expect(parseMarker("whatif-strip", " ids=a,b,c")).toEqual({ type: "whatif-strip", ids: ["a", "b", "c"] });
    expect(parseMarker("confetti", "")).toBeNull();
  });

  it("only links to real pages and ids", () => {
    const ids = new Set(WHAT_IF_SCENARIOS.map((s) => s.id));
    expect(ids.size).toBeGreaterThan(30);
    for (const p of PICKERS) expect(p.next.href).toMatch(/^\//);
    for (const t of TIMELINES) expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(diagramRegistry.length).toBeGreaterThan(10);
  });
});
