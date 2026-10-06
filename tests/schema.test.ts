import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");

const TABLES = [
  "users", "firms", "lawyers", "persons", "leads", "assignments", "documents", "comments", "activities",
  "consults", "engagements", "payments", "tasks", "fee_rule_versions", "billable_events", "invoices",
  "sequence_enrollments", "suppressions", "fact_verifications", "crm_deliveries", "seminars", "partners", "partner_gifts", "partner_referrals",
  "conversion_events", "review_requests", "audit_events",
];

describe("db/schema.sql", () => {
  it.each(TABLES)("%s exists with RLS enabled and forced", (t) => {
    expect(sql).toMatch(new RegExp(`CREATE TABLE ${t} \\(`));
    expect(sql).toMatch(new RegExp(`ALTER TABLE ${t}\\s+ENABLE ROW LEVEL SECURITY`));
    expect(sql).toMatch(new RegExp(`ALTER TABLE ${t}\\s+FORCE ROW LEVEL SECURITY`));
  });

  it("audit_events is insert-only with an immutability trigger", () => {
    expect(sql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM/);
    expect(sql).toMatch(/CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events/);
    const grants = sql.split("\n").filter((l) => /^GRANT/.test(l) && /audit_events/.test(l));
    for (const g of grants) expect(g).not.toMatch(/UPDATE|DELETE|TRUNCATE/);
  });

  it("fee_rule_versions is append-only", () => {
    expect(sql).toMatch(/CREATE TRIGGER fee_rule_versions_immutable BEFORE UPDATE OR DELETE ON fee_rule_versions/);
  });

  it("lead_offer_cards exposes the offer card but never intake", () => {
    const m = sql.match(/CREATE VIEW lead_offer_cards[\s\S]*?;/);
    expect(m).toBeTruthy();
    expect(m![0]).toContain("security_barrier");
    expect(m![0]).toContain("conflict_card");
    expect(m![0]).not.toMatch(/\bintake\b/);
    expect(m![0]).not.toMatch(/person_id|consent/);
  });

  it("lead_access exists and the leads policy excludes conflict_card viewers", () => {
    expect(sql).toMatch(/CREATE FUNCTION lead_access\(p_lead_id text\)/);
    expect(sql).toMatch(/CREATE POLICY leads_select ON leads[\s\S]*?lead_access\(id\) IN \('full','intake','client'\)/);
  });

  it("documents and engagements are closed to intake", () => {
    const docs = sql.match(/CREATE POLICY documents_select[\s\S]*?\);/)![0];
    expect(docs).not.toContain("'intake'");
    const eng = sql.match(/CREATE POLICY engagements_select[\s\S]*?\);/)![0];
    expect(eng).not.toContain("'intake'");
    expect(eng).toContain("status <> 'draft'");
  });

  it("marketing only gets the aggregate funnel view", () => {
    expect(sql).toMatch(/CREATE VIEW lead_funnel_daily/);
    expect(sql).not.toMatch(/POLICY[^;]*'marketing'[^;]*ON (leads|persons)/);
  });
});
