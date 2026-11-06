/**
 * Brevo (free plan) adapter on the v3 REST API (https://developers.brevo.com/reference).
 *
 * Brevo's free CRM caps open deals at 50, so a matter here is the Brevo contact itself: the stage,
 * capture and nurture flags live in contact attributes (EP_*), and notes are CRM notes linked to the
 * contact. Sequences run as Brevo automations that start when a contact is added to a list named
 * `ep-seq-<our sequence id>` (created by `npm run brevo:setup`).
 *
 * Safety: list membership is what starts a Brevo automation, so this adapter only adds contacts to
 * sequence lists when BREVO_ENROLL_LISTS=true. Until then it syncs contacts and attributes only, and
 * nothing in Brevo can send. Removing from lists (opt-outs, grief track, do-not-market) always runs.
 *
 * Auth is the `api-key` header, not a bearer token. Contact upserts with updateEnabled return 201 with
 * an id on create and 204 with no body on update, so the id is read back with a GET by email.
 */
import {
  CrmHttpError,
  assertFirmVisible,
  captureFields,
  nurtureFields,
  parseRetryAfter,
  type CrmAdapter,
  type NurtureState,
} from "@/server/crm/adapter";
import type { Activity, Comment, DocumentRecord, ExitReason, Lead, Person, Stage } from "@/server/types";

export const BREVO_LIST_PREFIX = "ep-seq-";
export const BREVO_FOLDER_NAME = "Estate planning sequences";

/**
 * Sequences that may keep running for a client or a do-not-market contact, because they are service
 * messages (onboarding, plan delivery, reviews), not marketing. Mirrors docs/crm-sequences.md.
 */
export const BREVO_SERVICE_SEQUENCES = ["consult_booked", "signed_onboarding", "plan_complete", "review_request", "annual_review"];
/** The only sequence a grief-track contact may be in. */
export const BREVO_GRIEF_SEQUENCE = "grief_support";

export interface BrevoConfig {
  apiKey: string;
  /** BREVO_ENROLL_LISTS=true: add contacts to sequence lists (starts automations). Default false. */
  enrollLists?: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Our snake_case field name to a Brevo attribute name (upper case letters, digits, underscore). */
export function brevoAttr(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

/** Contact attributes this adapter writes. `npm run brevo:setup` creates each as a text attribute. */
export const BREVO_ATTRIBUTES = [
  "FIRSTNAME",
  "LASTNAME",
  "EP_STATE",
  "EP_STAGE",
  "EP_MATTER_TYPE",
  "EP_CAPTURE_TOOL",
  "EP_CAPTURE_RESOURCE",
  "EP_PRIOR_TOOLS",
  "EP_SEGMENTS",
  "EP_HEARD_FROM",
  "EP_SENSITIVE_TRACK",
  "EP_CONSENT_AT",
  "EP_CONSENT_VERSION",
  "EP_SEQUENCES",
  "EP_SEQUENCE_GROUP",
  "EP_EMAIL_CONSENT",
  "EP_SMS_CONSENT",
  "EP_EMAIL_SUPPRESSED",
  "EP_SMS_SUPPRESSED",
  "EP_GRIEF_TRACK",
  "EP_CONSULT_BOOKED",
  "EP_CONSULT_HELD",
  "EP_RETAINER_SIGNED",
  "EP_DO_NOT_MARKET",
] as const;

/**
 * Which sequence lists a contact may be in, given the state we hold. The rules from docs/crm-sequences.md:
 * no email consent or suppressed: none; grief track: grief_support only; do-not-market (client, lost,
 * partner referral): service sequences only.
 */
export function allowedSequences(state: NurtureState): string[] {
  if (!state.emailConsent || state.emailSuppressed) return [];
  if (state.griefTrack) return state.sequences.filter((s) => s === BREVO_GRIEF_SEQUENCE);
  const active = state.sequences.filter((s) => s !== BREVO_GRIEF_SEQUENCE);
  if (state.doNotMarket) return active.filter((s) => BREVO_SERVICE_SEQUENCES.includes(s));
  return active;
}

export class BrevoAdapter implements CrmAdapter {
  readonly name = "brevo";
  private base: string;
  private fetchImpl: typeof fetch;
  private listCache?: Map<string, number>;

  constructor(private cfg: BrevoConfig) {
    this.base = (cfg.baseUrl ?? "https://api.brevo.com/v3").replace(/\/$/, "");
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async call(method: string, path: string, body?: unknown): Promise<any> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: { "api-key": this.cfg.apiKey, "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new CrmHttpError(res.status, parseRetryAfter(res.headers?.get?.("retry-after")));
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  private contactPath(contactId: string) {
    return `/contacts/${encodeURIComponent(contactId)}?identifierType=contact_id`;
  }

  async upsertContact(person: Person, lead: Lead) {
    const email = person.email.trim().toLowerCase();
    // Identity and consent time only: never consent IP, user agent or quiz answers.
    const attributes: Record<string, string> = {
      FIRSTNAME: person.firstName,
      LASTNAME: person.lastName,
      EP_STATE: lead.state ?? person.state ?? "",
      EP_CONSENT_AT: lead.consent?.capturedAt ?? "",
      EP_CONSENT_VERSION: lead.consent?.version ?? "",
    };
    const created = await this.call("POST", "/contacts", { email, attributes, updateEnabled: true });
    if (created?.id !== undefined) return { contactId: String(created.id) };
    const found = await this.call("GET", `/contacts/${encodeURIComponent(email)}?identifierType=email_id`);
    if (found?.id === undefined) throw new Error("Brevo did not return the contact id");
    return { contactId: String(found.id) };
  }

  /** The matter is the contact (free plan deal cap). Writes stage and capture fields; no sensitive segment names. */
  async upsertMatter(lead: Lead, _person: Person, ctx: { contactId: string }) {
    const cap = captureFields(lead);
    await this.call("PUT", this.contactPath(ctx.contactId), {
      attributes: {
        EP_STAGE: lead.exit?.reason ?? lead.stage,
        EP_MATTER_TYPE: lead.matterType,
        EP_CAPTURE_TOOL: cap.tool ?? "",
        EP_CAPTURE_RESOURCE: cap.resource ?? "",
        EP_PRIOR_TOOLS: cap.priorTools.join(";"),
        EP_SEGMENTS: cap.tags.join(";"),
        EP_HEARD_FROM: cap.heardFrom ?? "",
        EP_SENSITIVE_TRACK: cap.sensitiveTrack ? "true" : "false",
      },
    });
    return { matterId: ctx.contactId };
  }

  async setStage(matterId: string, stage: Stage, exit?: ExitReason) {
    await this.call("PUT", this.contactPath(matterId), { attributes: { EP_STAGE: exit ?? stage } });
  }

  private note(matterId: string, text: string) {
    return this.call("POST", "/crm/notes", { text, contactIds: [Number(matterId)] });
  }

  async logActivity(matterId: string, a: Activity) {
    const dir = a.direction ? ` (${a.direction})` : "";
    await this.note(matterId, `[${a.kind}${dir}] ${a.summary}`);
  }

  async addNote(matterId: string, comment: Comment) {
    assertFirmVisible(comment);
    await this.note(matterId, `${comment.authorName}: ${comment.body}`);
  }

  async attachDocument(matterId: string, doc: Pick<DocumentRecord, "id" | "name" | "kind" | "contentType" | "sizeBytes">, url: string) {
    // The file stays behind our signed URL; Brevo only gets a link in a note.
    await this.note(matterId, `Document (${doc.kind}): ${doc.name} ${url}`);
  }

  /** Name to id for every `ep-seq-*` list. Cached for the adapter's life (one cron run). */
  async sequenceLists(): Promise<Map<string, number>> {
    if (this.listCache) return this.listCache;
    const out = new Map<string, number>();
    for (let offset = 0; ; offset += 50) {
      const page = await this.call("GET", `/contacts/lists?limit=50&offset=${offset}`);
      const lists: { id: number; name: string }[] = page?.lists ?? [];
      for (const l of lists) if (l.name.startsWith(BREVO_LIST_PREFIX)) out.set(l.name.slice(BREVO_LIST_PREFIX.length), l.id);
      if (lists.length < 50) break;
    }
    this.listCache = out;
    return out;
  }

  /**
   * Full desired state each time: attributes, blocklist flag and sequence-list membership. Lists for
   * sequences the contact must not be in are always unlinked; links are added only with enrollLists.
   */
  async pushNurtureState(matterId: string, state: NurtureState) {
    const attributes = Object.fromEntries(Object.entries(nurtureFields(state)).map(([k, v]) => [brevoAttr(k), v]));
    const lists = await this.sequenceLists();
    const allowed = new Set(allowedSequences(state));
    const listIds = this.cfg.enrollLists ? [...allowed].map((s) => lists.get(s)).filter((id): id is number => id !== undefined) : [];
    const unlinkListIds = [...lists.entries()].filter(([seq]) => !allowed.has(seq)).map(([, id]) => id);
    await this.call("PUT", this.contactPath(matterId), {
      attributes,
      ...(state.emailSuppressed ? { emailBlacklisted: true } : {}),
      ...(listIds.length ? { listIds } : {}),
      ...(unlinkListIds.length ? { unlinkListIds } : {}),
    });
  }
}
