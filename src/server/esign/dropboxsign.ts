/**
 * Dropbox Sign (formerly HelloSign) API v3 adapter, API key as basic auth user.
 * Not exercised against the network in tests. Anything marked "verify against
 * provider docs before launch" is from memory of the API.
 */
import {
  hmac,
  safeEqual,
  WebhookSignatureError,
  type CreateEnvelopeInput,
  type EnvelopeStatus,
  type EsignProvider,
  type EsignWebhookEvent,
} from "@/server/esign/provider";

export interface DropboxSignConfig {
  apiKey: string;
  /** Set true for test mode (non-binding, free) */
  testMode?: boolean;
  fetchImpl?: typeof fetch;
}

const API = "https://api.hellosign.com/v3";

const EVENT_MAP: Record<string, EnvelopeStatus> = {
  signature_request_sent: "sent",
  signature_request_viewed: "viewed",
  signature_request_all_signed: "signed",
  signature_request_declined: "declined",
  signature_request_canceled: "voided",
};

interface SignatureRequest {
  is_complete?: boolean;
  is_declined?: boolean;
  has_error?: boolean;
  signatures?: { signer_email_address: string; status_code: string; last_viewed_at?: number | null }[];
}

export class DropboxSignProvider implements EsignProvider {
  readonly name = "dropboxsign";
  private readonly f: typeof fetch;

  constructor(private readonly cfg: DropboxSignConfig) {
    this.f = cfg.fetchImpl ?? fetch;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const auth = Buffer.from(`${this.cfg.apiKey}:`).toString("base64");
    const res = await this.f(`${API}${path}`, { ...init, headers: { Authorization: `Basic ${auth}`, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`Dropbox Sign ${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res;
  }

  async createEnvelope(input: CreateEnvelopeInput) {
    const form = new FormData();
    form.set("title", input.documentTitle);
    form.set("subject", input.documentTitle);
    form.set("signers[0][email_address]", input.signer.email);
    form.set("signers[0][name]", input.signer.name);
    if (input.requireSmsCode) {
      // verify against provider docs before launch: SMS authentication field names and plan availability
      form.set("signers[0][sms_phone_number]", input.signer.phone);
      form.set("signers[0][sms_phone_number_type]", "authentication");
    }
    form.set("metadata[engagementId]", input.engagementId);
    if (this.cfg.testMode) form.set("test_mode", "1");
    // verify against provider docs before launch: text file upload and signature placement (text tags)
    form.set("use_text_tags", "1");
    form.set("file[0]", new Blob([input.documentText], { type: "text/plain" }), "engagement.txt");
    const json = (await (await this.call("/signature_request/send", { method: "POST", body: form })).json()) as {
      signature_request: { signature_request_id: string };
    };
    return { envelopeId: json.signature_request.signature_request_id };
  }

  private async fetchRequest(envelopeId: string): Promise<SignatureRequest> {
    const json = (await (await this.call(`/signature_request/${envelopeId}`)).json()) as { signature_request: SignatureRequest };
    return json.signature_request;
  }

  async getStatus(envelopeId: string) {
    const r = await this.fetchRequest(envelopeId);
    const at = new Date().toISOString();
    if (r.is_complete) return { status: "signed" as const, at };
    if (r.is_declined) return { status: "declined" as const, at };
    // verify against provider docs before launch: a canceled request is a 404 on this endpoint
    if (r.signatures?.some((s) => s.last_viewed_at)) return { status: "viewed" as const, at };
    return { status: "sent" as const, at };
  }

  async sendReminder(envelopeId: string) {
    const r = await this.fetchRequest(envelopeId);
    const email = r.signatures?.[0]?.signer_email_address;
    if (!email) throw new Error("no signer to remind");
    await this.call(`/signature_request/remind/${envelopeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email_address: email }).toString(),
    });
  }

  async voidEnvelope(envelopeId: string, _reason: string) {
    // The cancel endpoint takes no reason; the caller records it in the audit log.
    await this.call(`/signature_request/cancel/${envelopeId}`, { method: "POST" });
  }

  async downloadSigned(envelopeId: string) {
    const res = await this.call(`/signature_request/files/${envelopeId}?file_type=pdf`, { headers: { Accept: "application/pdf" } });
    const pdf = new Uint8Array(await res.arrayBuffer());
    // verify against provider docs before launch: the signed PDF carries the audit trail page, so it doubles as the certificate
    return { pdf, auditCertificate: pdf };
  }

  parseWebhook(rawBody: string, _headers: Record<string, string>): EsignWebhookEvent[] {
    // Dropbox Sign posts a form field "json"; accept raw JSON too (verify against provider docs before launch)
    const payload = rawBody.trimStart().startsWith("{") ? rawBody : (new URLSearchParams(rawBody).get("json") ?? "");
    const body = JSON.parse(payload) as {
      event: { event_time: string; event_type: string; event_hash: string };
      signature_request?: { signature_request_id: string };
    };
    const { event_time, event_type, event_hash } = body.event;
    if (!event_hash || !safeEqual(event_hash, hmac(this.cfg.apiKey, event_time + event_type, "hex"))) throw new WebhookSignatureError();
    const status = EVENT_MAP[event_type];
    const id = body.signature_request?.signature_request_id;
    if (!status || !id) return [];
    return [{ envelopeId: id, status, at: new Date(Number(event_time) * 1000).toISOString() }];
  }
}
