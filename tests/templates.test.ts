import { describe, expect, it } from "vitest";
import { firm } from "@/config/firm";
import { verifyAuditChain } from "@/server/audit/log";
import { can, ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb } from "@/server/db";
import { BANNED_PHRASES, lintCopy, sensitiveContentIssues } from "@/server/nurture/compliance";
import { SEQUENCES } from "@/server/nurture/sequences";
import { PLACEHOLDERS, TEMPLATE_COPY, getTemplateCopy } from "@/server/nurture/templateCopy";
import {
  ApprovedTemplateSource,
  SAMPLE_VARS,
  approveTemplate,
  contentHash,
  listTemplateRows,
  renderCopy,
  renderText,
  stepsWithoutCopy,
  textToHtml,
  type TemplateVars,
} from "@/server/nurture/templates";
import type { Actor, Role } from "@/server/types";

const NOW = new Date("2026-10-06T12:00:00Z");
const actor = (role: Role, userId = `u-${role}`): Actor => ({ userId, role, firmId: "f1", lawyerId: "l1", mfa: true });
const source = new ApprovedTemplateSource();
const KEY = "qz_1_results";
const hashOf = (key: string) => contentHash(getTemplateCopy(key)!);

describe("template copy", () => {
  const stepByKey = new Map(SEQUENCES.flatMap((s) => s.steps).map((st) => [st.templateKey, st]));

  it("has one template per key, every key a real step, with the step's channel", () => {
    const keys = TEMPLATE_COPY.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TEMPLATE_COPY) {
      const step = stepByKey.get(t.key);
      expect(step, t.key).toBeDefined();
      expect(t.channel, t.key).toBe(step!.channel);
    }
  });

  it("uses only the allowed placeholders", () => {
    for (const t of TEMPLATE_COPY) {
      for (const text of [t.subject ?? "", t.body]) {
        for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) expect(PLACEHOLDERS as readonly string[], `${t.key} {{${m[1]}}}`).toContain(m[1]);
        expect(text.replaceAll(firm.officeAddress, "").replace(/\{\{\s*\w+\s*\}\}/g, ""), t.key).not.toMatch(/[{}[\]]/);
      }
    }
  });

  it("emails carry the subject, unsubscribe link and postal address; texts carry no subject", () => {
    for (const t of TEMPLATE_COPY) {
      if (t.channel === "email") {
        expect(t.subject, t.key).toBeTruthy();
        expect(t.body, t.key).toContain("{{unsubscribeUrl}}");
        expect(t.body, t.key).toContain(firm.officeAddress);
      } else {
        expect(t.subject, t.key).toBeUndefined();
      }
    }
  });

  it("every SMS says how to opt out and stays short", () => {
    for (const t of TEMPLATE_COPY.filter((x) => x.channel === "sms")) {
      expect(t.body, t.key).toContain("Reply STOP to opt out");
      expect(renderText(t.body, SAMPLE_VARS).length, t.key).toBeLessThanOrEqual(320);
    }
  });

  it("passes the copy lint and the sensitive-content rules", () => {
    expect(BANNED_PHRASES.length).toBeGreaterThan(0);
    for (const t of TEMPLATE_COPY) {
      const body = lintCopy(t.body, { requireDisclaimer: t.channel === "email" });
      expect(body.issues, `${t.key} body`).toEqual([]);
      if (t.subject) expect(lintCopy(t.subject, { requireDisclaimer: false }).issues, `${t.key} subject`).toEqual([]);
      expect(sensitiveContentIssues(t.body, t.channel, "body"), `${t.key} body`).toEqual([]);
      if (t.subject) expect(sensitiveContentIssues(t.subject, t.channel, "subject"), `${t.key} subject`).toEqual([]);
    }
  });

  it("makes no claims the launch check bans", () => {
    for (const t of TEMPLATE_COPY) expect(`${t.subject ?? ""} ${t.body}`, t.key).not.toMatch(/\bspeciali[sz]t|\bguarantee|\bbest\b/i);
  });

  it("reports which steps have no copy, never a key with copy", () => {
    const missing = stepsWithoutCopy();
    expect(missing.length).toBeGreaterThan(0);
    for (const m of missing) expect(getTemplateCopy(m.templateKey)).toBeUndefined();
    expect(missing.length + TEMPLATE_COPY.length).toBe(SEQUENCES.flatMap((s) => s.steps).length);
  });

  it("hashes every template distinctly", () => {
    expect(new Set(TEMPLATE_COPY.map(contentHash)).size).toBe(TEMPLATE_COPY.length);
  });
});

describe("rendering", () => {
  it("fills placeholders and builds escaped paragraph html", () => {
    const copy = getTemplateCopy(KEY)!;
    const r = renderCopy(copy, { ...SAMPLE_VARS, firstName: "A <b>&\"'" });
    expect(r.subject).toBe(`Your plan finder results, A <b>&"'`);
    expect(r.text).toContain("Hi A <b>&\"',");
    expect(r.text).not.toMatch(/\{\{/);
    expect(r.html).toContain("<p>Hi A &lt;b&gt;&amp;&quot;&#39;,</p>");
    expect(r.html).not.toContain("<b>");
    expect(r.text).toContain(firm.officeAddress);
  });

  it("drops the line of a missing optional value instead of leaving the placeholder", () => {
    const copy = getTemplateCopy(KEY)!;
    const vars: TemplateVars = { firstName: "Sam", firmName: "F", unsubscribeUrl: "https://x.test/u" };
    const r = renderCopy(copy, vars);
    expect(r.text).not.toMatch(/\{\{|undefined|You can pick a time/);
    expect(r.text).not.toContain("bookingUrl");
    expect(r.text).not.toMatch(/\n{3,}/);
    expect(r.text).toContain("https://x.test/u");
    expect(renderText("a\n{{attorneyName}}\nb", { ...vars, attorneyName: "   " })).toBe("a\nb");
  });

  it("requires unsubscribeUrl", () => {
    const copy = getTemplateCopy(KEY)!;
    expect(() => renderCopy(copy, { ...SAMPLE_VARS, unsubscribeUrl: "" })).toThrow(/unsubscribeUrl/);
  });

  it("never re-expands or splits lines on a value", () => {
    const text = renderText("Hi {{firstName}}\n{{firmName}}", { ...SAMPLE_VARS, firstName: "{{firmName}}\n\nINJECT", firmName: "F" });
    expect(text).toBe("Hi {{firmName}} INJECT\nF");
  });

  it("converts text to escaped paragraphs", () => {
    expect(textToHtml("a & b\nline two\n\n<script>")).toBe("<p>a &amp; b<br>\nline two</p>\n<p>&lt;script&gt;</p>");
  });
});

describe("approval", () => {
  it("renders nothing until the current copy is approved", async () => {
    const db = createMemoryDb();
    expect(await source.render(db, KEY, "email", SAMPLE_VARS)).toBeNull();
    const a = await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY), note: "ok" }, NOW);
    expect(a).toMatchObject({ id: `${KEY}@1`, version: 1, approvedBy: "u-attorney", approvedAt: NOW.toISOString(), note: "ok", contentHash: hashOf(KEY) });
    const r = await source.render(db, KEY, "email", SAMPLE_VARS);
    expect(r).toMatchObject({ templateKey: KEY, templateVersion: `${KEY}@1` });
    expect(r!.subject).toContain("Sam");
    expect(r!.html).toContain("<p>");
    expect(r!.text).toContain(SAMPLE_VARS.unsubscribeUrl);
  });

  it("returns null for unknown keys, a channel that does not match, and other templates", async () => {
    const db = createMemoryDb();
    await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW);
    expect(await source.render(db, "no_such_key", "email", SAMPLE_VARS)).toBeNull();
    expect(await source.render(db, KEY, "sms", SAMPLE_VARS)).toBeNull();
    expect(await source.render(db, "qz_3_cost", "email", SAMPLE_VARS)).toBeNull();
  });

  it("renders sms without subject or html", async () => {
    const db = createMemoryDb();
    await approveTemplate(db, actor("platform_admin"), { templateKey: "ns_sms_same_day", contentHash: hashOf("ns_sms_same_day") }, NOW);
    const r = await source.render(db, "ns_sms_same_day", "sms", SAMPLE_VARS);
    expect(r!.subject).toBeUndefined();
    expect(r!.html).toBeUndefined();
    expect(r!.text).toContain("Reply STOP to opt out.");
  });

  it("an edit changes the hash, so the old approval stops covering it and the new one is version 2", async () => {
    const db = createMemoryDb();
    await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW);
    const copy = getTemplateCopy(KEY)!;
    const original = copy.body;
    try {
      copy.body = original.replace("Thank you", "Thanks");
      expect(hashOf(KEY)).not.toBe((await db.templateApprovals.get(`${KEY}@1`))!.contentHash);
      expect(await source.render(db, KEY, "email", SAMPLE_VARS)).toBeNull();
      expect((await listTemplateRows(db, actor("attorney"))).find((r) => r.copy.key === KEY)).toMatchObject({ status: "changed" });
      const v2 = await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW);
      expect(v2.version).toBe(2);
      expect((await source.render(db, KEY, "email", SAMPLE_VARS))!.templateVersion).toBe(`${KEY}@2`);
      expect((await db.templateApprovals.list()).length).toBe(2);
      // putting the old words back is covered by the first approval again
      copy.body = original;
      expect((await source.render(db, KEY, "email", SAMPLE_VARS))!.templateVersion).toBe(`${KEY}@1`);
    } finally {
      copy.body = original;
    }
  });

  it("rejects a hash that is not the current copy, unknown keys and duplicate approvals", async () => {
    const db = createMemoryDb();
    await expect(approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: "0".repeat(64) }, NOW)).rejects.toThrow(/changed while you were reviewing/);
    await expect(approveTemplate(db, actor("attorney"), { templateKey: "nope", contentHash: "x" }, NOW)).rejects.toThrow(/Unknown template/);
    await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW);
    await expect(approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW)).rejects.toThrow(/already approved/);
    expect((await db.templateApprovals.list()).length).toBe(1);
  });

  it("audits every approval on the hash chain", async () => {
    const db = createMemoryDb();
    await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW);
    const events = await db.audit.list();
    expect(events.map((e) => [e.action, e.resourceType, e.resourceId, e.actorId])).toEqual([["template.approve", "template", KEY, "u-attorney"]]);
    expect(verifyAuditChain(events).ok).toBe(true);
  });

  it("lists every template with a status and preview, changed and pending first", async () => {
    const db = createMemoryDb();
    await approveTemplate(db, actor("attorney"), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW);
    const rows = await listTemplateRows(db, actor("platform_admin"));
    expect(rows.length).toBe(TEMPLATE_COPY.length);
    expect(rows.at(-1)!.copy.key).toBe(KEY);
    expect(rows.at(-1)!.status).toBe("approved");
    expect(rows.slice(0, -1).every((r) => r.status === "pending")).toBe(true);
    for (const r of rows) expect(r.preview.text, r.copy.key).not.toMatch(/\{\{/);
  });
});

describe("permissions", () => {
  it("only attorneys and platform admins can approve or list", () => {
    const roles: Role[] = ["platform_admin", "attorney", "firm_admin", "paralegal", "intake", "marketing", "client"];
    expect(roles.filter((r) => can(actor(r), "approve_templates"))).toEqual(["platform_admin", "attorney"]);
  });

  it("refuses everyone else without writing or auditing", async () => {
    const db = createMemoryDb();
    for (const role of ["firm_admin", "paralegal", "intake", "marketing", "client"] as const) {
      await expect(approveTemplate(db, actor(role), { templateKey: KEY, contentHash: hashOf(KEY) }, NOW), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listTemplateRows(db, actor(role)), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.templateApprovals.list()).toEqual([]);
    expect(await db.audit.list()).toEqual([]);
  });
});
