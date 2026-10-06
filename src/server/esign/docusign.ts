/**
 * DocuSign eSignature REST v2.1 adapter. The JWT access token is obtained by the
 * caller and passed in config; this class never mints tokens. Not exercised
 * against the network in tests. Anything marked "verify against provider docs
 * before launch" is from memory of the API.
 */
import {
  hmac,
  lowerHeaders,
  safeEqual,
  WebhookSignatureError,
  type CreateEnvelopeInput,
  type EnvelopeStatus,
  type EsignProvider,
  type EsignWebhookEvent,
} from "@/server/esign/provider";

export interface DocusignConfig {
  accountId: string;
  accessToken: string;
  /** e.g. https://demo.docusign.net (sandbox) or the account's base_uri from userinfo */
  baseUri: string;
  /** Connect HMAC key */
  hmacKey: string;
  fetchImpl?: typeof fetch;
}

const STATUS_MAP: Record<string, EnvelopeStatus> = {
  sent: "sent",
  delivered: "viewed",
  completed: "signed",
  declined: "declined",
  voided: "voided",
};

const EVENT_MAP: Record<string, EnvelopeStatus> = {
  "envelope-sent": "sent",
  "recipient-delivered": "viewed", // verify against provider docs before launch
  "envelope-completed": "signed",
  "envelope-declined": "declined",
  "envelope-voided": "voided",
};

export class DocusignProvider implements EsignProvider {
  readonly name = "docusign";
  private readonly f: typeof fetch;

  constructor(private readonly cfg: DocusignConfig) {
    this.f = cfg.fetchImpl ?? fetch;
  }

  private url(path: string): string {
    return `${this.cfg.baseUri}/restapi/v2.1/accounts/${this.cfg.accountId}${path}`;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.f(this.url(path), {
      ...init,
      headers: { Authorization: `Bearer ${this.cfg.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`DocuSign ${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res;
  }

  async createEnvelope(input: CreateEnvelopeInput) {
    const signer: Record<string, unknown> = {
      email: input.signer.email,
      name: input.signer.name,
      recipientId: "1",
      routingOrder: "1",
      tabs: { signHereTabs: [{ anchorString: "/sign/", anchorUnits: "pixels" }], dateSignedTabs: [{ anchorString: "/date/" }] },
    };
    if (input.requireSmsCode) {
      // verify against provider docs before launch: SMS authentication needs the account feature enabled
      signer.requireIdLookup = "true";
      signer.idCheckConfigurationName = "SMS Auth $";
      signer.smsAuthentication = { senderProvidedNumbers: [input.signer.phone] };
    }
    const body = {
      emailSubject: input.documentTitle,
      status: "sent",
      // verify against provider docs before launch: plain text upload ("txt") may need conversion to PDF first
      documents: [
        { documentId: "1", name: input.documentTitle, fileExtension: "txt", documentBase64: Buffer.from(input.documentText).toString("base64") },
      ],
      recipients: { signers: [signer] },
      customFields: { textCustomFields: [{ name: "engagementId", value: input.engagementId, show: "false" }] },
      // verify against provider docs before launch: signer language and redirect are set per recipient/embedded view
    };
    const res = await this.call("/envelopes", { method: "POST", body: JSON.stringify(body) });
    const json = (await res.json()) as { envelopeId: string };
    // Email signing only: an embedded signing URL needs clientUserId and a recipient view call.
    return { envelopeId: json.envelopeId };
  }

  async getStatus(envelopeId: string) {
    const json = (await (await this.call(`/envelopes/${envelopeId}`)).json()) as { status: string; statusChangedDateTime?: string };
    const status = STATUS_MAP[json.status] ?? "sent";
    return { status, at: json.statusChangedDateTime ?? new Date().toISOString() };
  }

  async sendReminder(envelopeId: string) {
    // verify against provider docs before launch: resending is a PUT on the recipients with resend_envelope=true
    await this.call(`/envelopes/${envelopeId}/recipients?resend_envelope=true`, { method: "PUT", body: JSON.stringify({ signers: [{ recipientId: "1" }] }) });
  }

  async voidEnvelope(envelopeId: string, reason: string) {
    await this.call(`/envelopes/${envelopeId}`, { method: "PUT", body: JSON.stringify({ status: "voided", voidedReason: reason }) });
  }

  async downloadSigned(envelopeId: string) {
    const pdf = await this.call(`/envelopes/${envelopeId}/documents/combined`, { headers: { Accept: "application/pdf" } });
    const cert = await this.call(`/envelopes/${envelopeId}/documents/certificate`, { headers: { Accept: "application/pdf" } });
    return { pdf: new Uint8Array(await pdf.arrayBuffer()), auditCertificate: new Uint8Array(await cert.arrayBuffer()) };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): EsignWebhookEvent[] {
    const sig = lowerHeaders(headers)["x-docusign-signature-1"];
    if (!sig || !safeEqual(sig, hmac(this.cfg.hmacKey, rawBody, "base64"))) throw new WebhookSignatureError();
    // Connect JSON format (verify against provider docs before launch)
    const body = JSON.parse(rawBody) as { event?: string; generatedDateTime?: string; data?: { envelopeId?: string } };
    const status = body.event ? EVENT_MAP[body.event] : undefined;
    if (!status || !body.data?.envelopeId) return [];
    return [{ envelopeId: body.data.envelopeId, status, at: body.generatedDateTime ?? new Date().toISOString() }];
  }
}
