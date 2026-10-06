/**
 * Lawmatics adapter (default CRM). Lawmatics "prospects" are our matters.
 * Every endpoint shape below is from memory of their REST API: verify against
 * Lawmatics API docs before launch (paths, field names, and how stage/status is set).
 */
import {
  LAWMATICS_STAGE_MAP,
  assertFirmVisible,
  requestJson,
  resolveStage,
  type CrmAdapter,
  type StageMap,
  captureFields,
} from "@/server/crm/adapter";
import type { Activity, Comment, DocumentRecord, ExitReason, Lead, Person, Stage } from "@/server/types";

export interface LawmaticsConfig {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  stageMap?: Partial<StageMap>;
}

export class LawmaticsAdapter implements CrmAdapter {
  readonly name = "lawmatics";
  private base: string;
  private fetchImpl: typeof fetch;
  private stageMap: StageMap;

  constructor(private cfg: LawmaticsConfig) {
    this.base = (cfg.baseUrl ?? "https://api.lawmatics.com/v1").replace(/\/$/, "");
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.stageMap = { ...LAWMATICS_STAGE_MAP, ...cfg.stageMap };
  }

  private call(method: string, path: string, body?: unknown) {
    return requestJson(this.fetchImpl, `${this.base}${path}`, { method, token: this.cfg.token, body });
  }

  private idOf(json: any): string {
    const id = json?.data?.id ?? json?.id;
    if (id === undefined || id === null) throw new Error("Lawmatics response had no id");
    return String(id);
  }

  async upsertContact(person: Person, _lead: Lead) {
    // Only identity fields. No consent IP/user agent, no quiz answers.
    const fields = {
      first_name: person.firstName,
      last_name: person.lastName,
      email: person.email,
      phone: person.phone,
      state: person.state,
    };
    // verify against Lawmatics API docs before launch: email filter on contact search.
    const found = await this.call("GET", `/contacts?email=${encodeURIComponent(person.email)}`);
    const existing = Array.isArray(found?.data) ? found.data[0] : undefined;
    if (existing?.id !== undefined) {
      await this.call("PUT", `/contacts/${existing.id}`, fields);
      return { contactId: String(existing.id) };
    }
    return { contactId: this.idOf(await this.call("POST", "/contacts", fields)) };
  }

  async upsertMatter(lead: Lead, person: Person, ctx: { contactId: string }) {
    const cap = captureFields(lead);
    // verify against Lawmatics API docs before launch: prospect create body and stage field name.
    const json = await this.call("POST", "/prospects", {
      contact_id: ctx.contactId,
      case_title: `${person.lastName}, ${person.firstName} - ${lead.matterType}`,
      status: resolveStage(this.stageMap, lead.stage, lead.exit?.reason),
      state: lead.state,
      // Non-confidential summary only. Intake free text goes in notes, never in
      // custom fields that could be mapped to ad-platform audiences.
      description: lead.offerSummary,
      lead_score: lead.score.score,
      lead_grade: lead.score.grade,
      source: lead.source.utmSource ?? lead.source.referrer,
      // verify against Lawmatics API docs before launch: tags and custom field keys.
      tags: [...cap.tags, ...(cap.sensitiveTrack ? ["sensitive_track"] : [])],
      custom_fields: { capture_tool: cap.tool, capture_resource: cap.resource, prior_tools: cap.priorTools.join(","), heard_from: cap.heardFrom },
    });
    return { matterId: this.idOf(json) };
  }

  async setStage(matterId: string, stage: Stage, exit?: ExitReason) {
    await this.call("PUT", `/prospects/${matterId}`, { status: resolveStage(this.stageMap, stage, exit) });
  }

  async logActivity(matterId: string, a: Activity) {
    // verify against Lawmatics API docs before launch: events resource and field names.
    await this.call("POST", "/events", {
      prospect_id: matterId,
      name: `${a.kind}${a.direction ? ` (${a.direction})` : ""}`,
      description: a.summary,
      start_date: a.at,
    });
  }

  async addNote(matterId: string, comment: Comment) {
    assertFirmVisible(comment);
    // verify against Lawmatics API docs before launch: polymorphic notable_type/notable_id.
    await this.call("POST", "/notes", {
      notable_type: "Prospect",
      notable_id: matterId,
      body: `${comment.authorName}: ${comment.body}`,
    });
  }

  async attachDocument(
    matterId: string,
    doc: Pick<DocumentRecord, "id" | "name" | "kind" | "contentType" | "sizeBytes">,
    url: string,
  ) {
    // verify against Lawmatics API docs before launch: attachments may require multipart upload instead of a URL.
    await this.call("POST", `/prospects/${matterId}/documents`, {
      name: doc.name,
      kind: doc.kind,
      content_type: doc.contentType,
      url,
    });
  }
}
