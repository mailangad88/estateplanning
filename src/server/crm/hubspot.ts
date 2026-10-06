/**
 * HubSpot adapter on the CRM v3 objects API. Matters are deals; contacts are deduped
 * on email, then phone, before creating. Notes are note objects associated to the deal.
 * Association type ids are HubSpot-defined: deal->contact 3, note->deal 214.
 */
import {
  HUBSPOT_STAGE_MAP,
  assertFirmVisible,
  fullName,
  requestJson,
  resolveStage,
  type CrmAdapter,
  type StageMap,
  captureFields,
  nurtureFields,
  type NurtureState,
} from "@/server/crm/adapter";
import type { Activity, Comment, DocumentRecord, ExitReason, Lead, Person, Stage } from "@/server/types";

export interface HubSpotConfig {
  token: string;
  /** Deal pipeline id; "default" when unset. */
  pipelineId?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  stageMap?: Partial<StageMap>;
}

const HS = "HUBSPOT_DEFINED";

export class HubSpotAdapter implements CrmAdapter {
  readonly name = "hubspot";
  private base: string;
  private fetchImpl: typeof fetch;
  private stageMap: StageMap;

  constructor(private cfg: HubSpotConfig) {
    this.base = (cfg.baseUrl ?? "https://api.hubapi.com").replace(/\/$/, "");
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.stageMap = { ...HUBSPOT_STAGE_MAP, ...cfg.stageMap };
  }

  private call(method: string, path: string, body?: unknown) {
    return requestJson(this.fetchImpl, `${this.base}${path}`, { method, token: this.cfg.token, body });
  }

  private async findContact(property: "email" | "phone", value: string): Promise<string | undefined> {
    const res = await this.call("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }],
      limit: 1,
    });
    const hit = res?.results?.[0]?.id;
    return hit === undefined ? undefined : String(hit);
  }

  async upsertContact(person: Person, _lead: Lead) {
    // Identity fields only: no consent IP/user agent, no quiz answers.
    const properties = {
      email: person.email,
      firstname: person.firstName,
      lastname: person.lastName,
      phone: person.phone,
      state: person.state,
    };
    const existing = (await this.findContact("email", person.email)) ?? (await this.findContact("phone", person.phone));
    if (existing) {
      await this.call("PATCH", `/crm/v3/objects/contacts/${existing}`, { properties });
      return { contactId: existing };
    }
    const created = await this.call("POST", "/crm/v3/objects/contacts", { properties });
    return { contactId: String(created.id) };
  }

  async upsertMatter(lead: Lead, person: Person, ctx: { contactId: string }) {
    const cap = captureFields(lead);
    const created = await this.call("POST", "/crm/v3/objects/deals", {
      properties: {
        dealname: `${fullName(person)} - ${lead.matterType}`,
        pipeline: this.cfg.pipelineId ?? "default",
        dealstage: resolveStage(this.stageMap, lead.stage, lead.exit?.reason),
        // Quiz free text deliberately stays out of deal properties: HubSpot properties
        // can feed ad audiences. It travels as notes only.
        description: lead.offerSummary,
        // Custom deal properties to create in HubSpot (configure before launch). Sensitive
        // segments never appear here; workflows route on ep_sensitive_track instead.
        ep_capture_tool: cap.tool ?? "",
        ep_capture_resource: cap.resource ?? "",
        ep_prior_tools: cap.priorTools.join(";"),
        ep_segments: cap.tags.join(";"),
        ep_heard_from: cap.heardFrom ?? "",
        ep_sensitive_track: cap.sensitiveTrack ? "true" : "false",
      },
      associations: [{ to: { id: ctx.contactId }, types: [{ associationCategory: HS, associationTypeId: 3 }] }],
    });
    return { matterId: String(created.id) };
  }

  async setStage(matterId: string, stage: Stage, exit?: ExitReason) {
    await this.call("PATCH", `/crm/v3/objects/deals/${matterId}`, {
      properties: { dealstage: resolveStage(this.stageMap, stage, exit) },
    });
  }

  private note(matterId: string, body: string, at: string) {
    return this.call("POST", "/crm/v3/objects/notes", {
      properties: { hs_note_body: body, hs_timestamp: at },
      associations: [{ to: { id: matterId }, types: [{ associationCategory: HS, associationTypeId: 214 }] }],
    });
  }

  async logActivity(matterId: string, a: Activity) {
    const dir = a.direction ? ` (${a.direction})` : "";
    await this.note(matterId, `[${a.kind}${dir}] ${a.summary}`, a.at);
  }

  async addNote(matterId: string, comment: Comment) {
    assertFirmVisible(comment);
    await this.note(matterId, `${comment.authorName}: ${comment.body}`, comment.createdAt);
  }

  async attachDocument(
    matterId: string,
    doc: Pick<DocumentRecord, "id" | "name" | "kind" | "contentType" | "sizeBytes">,
    url: string,
  ) {
    // Files API upload would need multipart; a linked note keeps the document behind our signed URL.
    await this.note(matterId, `Document (${doc.kind}): ${doc.name} ${url}`, new Date().toISOString());
  }

  /**
   * Nurture state for HubSpot workflows. TO BE VERIFIED against HubSpot docs before launch: the "ep_*"
   * custom properties must exist on deals and contacts, and opting a contact out of marketing email is
   * done with the contact property hs_email_optout (HubSpot may restrict who can set it; the
   * subscription-status APIs are the other route).
   */
  async pushNurtureState(matterId: string, state: NurtureState) {
    const properties = nurtureFields(state);
    await this.call("PATCH", `/crm/v3/objects/deals/${matterId}`, { properties });
    const contactId = state.contactEmail ? await this.findContact("email", state.contactEmail) : undefined;
    if (contactId) {
      await this.call("PATCH", `/crm/v3/objects/contacts/${contactId}`, {
        properties: { ...properties, ...(state.emailSuppressed ? { hs_email_optout: "true" } : {}) },
      });
    }
  }
}
