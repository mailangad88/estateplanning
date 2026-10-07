import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");

const TABLES = [
  "users", "firms", "lawyers", "persons", "leads", "assignments", "documents", "comments", "activities",
  "consults", "engagements", "payments", "tasks", "fee_rule_versions", "billable_events", "invoices",
  "sequence_enrollments", "suppressions", "fact_verifications", "template_approvals", "page_approvals", "crm_deliveries", "seminars", "partners", "partner_gifts", "partner_referrals",
  "conversion_events", "review_requests", "family_plans", "family_plan_bodies", "plan_link_uses", "plan_mfa", "plan_sessions",
  "retainer_templates", "engagement_signatures", "stored_blobs", "audit_events",
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

  it("page_approvals is append-only, written only by attorneys and platform admins as themselves", () => {
    expect(sql).toMatch(/CREATE TRIGGER page_approvals_immutable BEFORE UPDATE OR DELETE ON page_approvals/);
    expect(sql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON page_approvals FROM PUBLIC, app_user, app_service;/);
    expect(sql).toMatch(/CREATE POLICY page_approvals_insert ON page_approvals FOR INSERT TO app_user\s+WITH CHECK \(app_role\(\) IN \('platform_admin','attorney'\) AND approved_by = app_user_id\(\) AND approver_role = app_role\(\)\)/);
    expect(sql).toMatch(/GRANT SELECT ON page_approvals TO app_service;/);
    expect(sql).not.toMatch(/GRANT [A-Z, ]*(INSERT|UPDATE|DELETE)[A-Z, ]* ON page_approvals TO app_service/);
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

  it("family plan answers have no staff read path, and planners cannot relink a plan", () => {
    const bodies = sql.match(/CREATE POLICY family_plan_bodies_\w+[\s\S]*?;/g) ?? [];
    expect(bodies.length).toBeGreaterThan(0);
    for (const p of bodies) expect(p).not.toMatch(/'(attorney|intake|platform_admin|firm_admin|paralegal|client|marketing)'/);
    expect(sql).toMatch(/CREATE POLICY family_plans_owner ON family_plans[\s\S]*?app_role\(\) = 'planner' AND id = app_user_id\(\)/);
    expect(sql).toMatch(/CREATE TRIGGER family_plans_owner_guard BEFORE INSERT OR UPDATE ON family_plans/);
  });

  it("family plan accounts: second factor and devices are the owner's alone; staff have no policy at all", () => {
    for (const t of ["plan_mfa", "plan_sessions"]) {
      const policies = sql.match(new RegExp(`CREATE POLICY \\w+ ON ${t}\\b[\\s\\S]*?;`, "g")) ?? [];
      expect(policies.length, t).toBe(2); // service_all + the owner policy
      for (const p of policies.filter((x) => /TO app_user/.test(x))) {
        expect(p).toMatch(/app_role\(\) = 'planner'/);
        expect(p).not.toMatch(/'(attorney|intake|platform_admin|firm_admin|paralegal|client|marketing)'/);
      }
      expect(sql).toMatch(new RegExp(`REFERENCES family_plans\\(id\\) ON DELETE CASCADE[\\s\\S]*?\\n\\);`));
      const userGrants = sql.split("\n").filter((l) => /^GRANT/.test(l) && new RegExp(`\\b${t}\\b`).test(l) && /TO app_user/.test(l));
      expect(userGrants.length, t).toBe(1);
      expect(userGrants[0].split("--")[0]).not.toMatch(/INSERT/); // created by the service role at sign-in, never by a planner
    }
    expect(sql).toMatch(/CREATE POLICY audit_select ON audit_events[\s\S]*?app_role\(\) = 'planner' AND resource_type = 'family_plan' AND resource_id = app_user_id\(\)/);
  });

  it("retainer templates are firm-scoped, approved only by the firm's attorney, and their wording is immutable", () => {
    const select = sql.match(/CREATE POLICY retainer_templates_select[\s\S]*?\);/)![0];
    expect(select).toMatch(/firm_id = app_firm_id\(\)/);
    const writes = sql.match(/CREATE POLICY retainer_templates_(insert|update)[\s\S]*?;/g) ?? [];
    expect(writes.length).toBe(2);
    for (const w of writes) {
      expect(w).toMatch(/firm_id = app_firm_id\(\)/);
      expect(w).not.toMatch(/'(platform_admin|paralegal|intake|marketing|client)'/);
    }
    expect(sql).toMatch(/CREATE TRIGGER retainer_templates_guard BEFORE INSERT OR UPDATE OR DELETE ON retainer_templates/);
    const guard = sql.match(/CREATE FUNCTION retainer_template_guard[\s\S]*?END \$\$;/)![0];
    expect(guard).toMatch(/app_role\(\) = 'attorney' AND NEW.approved_by = app_user_id\(\) AND NEW.firm_id = app_firm_id\(\)/);
    expect(guard).toMatch(/NEW.body IS DISTINCT FROM OLD.body/);
  });

  it("signature records and stored blobs are insert-only; blobs have no user policy", () => {
    for (const t of ["engagement_signatures", "stored_blobs"]) {
      expect(sql).toMatch(new RegExp(`CREATE TRIGGER ${t}_immutable BEFORE UPDATE OR DELETE ON ${t}`));
      expect(sql).toMatch(new RegExp(`REVOKE UPDATE, DELETE, TRUNCATE ON ${t} FROM PUBLIC, app_user, app_service;`));
      const grants = sql.split("\n").filter((l) => /^GRANT/.test(l) && new RegExp(`\\b${t}\\b`).test(l));
      for (const g of grants) expect(g).not.toMatch(/UPDATE|DELETE|TRUNCATE/);
    }
    expect(sql).not.toMatch(/CREATE POLICY \w+ ON stored_blobs[^;]*TO app_user/);
    expect(sql.split("\n").filter((l) => /^GRANT/.test(l) && /stored_blobs/.test(l) && /TO app_user/.test(l))).toEqual([]);
    expect(sql).toMatch(/CREATE POLICY engagement_signatures_select ON engagement_signatures FOR SELECT TO app_user\s+USING \(lead_access\(lead_id\) IN \('full','client'\)\)/);
  });

  it("marketing only gets the aggregate funnel view", () => {
    expect(sql).toMatch(/CREATE VIEW lead_funnel_daily/);
    expect(sql).not.toMatch(/POLICY[^;]*'marketing'[^;]*ON (leads|persons)/);
  });
});
