/**
 * In-memory e-sign provider for tests and local development (no credentials).
 * Deterministic ids; helpers simulate the client opening and signing, and
 * `webhookFor` produces a correctly signed webhook body.
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

interface MockEnvelope {
  input: CreateEnvelopeInput;
  status: EnvelopeStatus;
  at: string;
  reminders: number;
  voidReason?: string;
}

export class MockEsignProvider implements EsignProvider {
  readonly name = "mock";
  readonly envelopes = new Map<string, MockEnvelope>();
  private counter = 0;

  constructor(
    private readonly secret = "mock-webhook-secret",
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createEnvelope(input: CreateEnvelopeInput) {
    const envelopeId = `mock-env-${++this.counter}`;
    this.envelopes.set(envelopeId, { input, status: "sent", at: this.clock().toISOString(), reminders: 0 });
    return { envelopeId, signingUrl: `https://sign.mock.local/${envelopeId}` };
  }

  private get(id: string): MockEnvelope {
    const e = this.envelopes.get(id);
    if (!e) throw new Error(`unknown envelope ${id}`);
    return e;
  }

  async getStatus(envelopeId: string) {
    const e = this.get(envelopeId);
    return { status: e.status, at: e.at };
  }

  async sendReminder(envelopeId: string) {
    this.get(envelopeId).reminders += 1;
  }

  async voidEnvelope(envelopeId: string, reason: string) {
    const e = this.get(envelopeId);
    e.status = "voided";
    e.voidReason = reason;
    e.at = this.clock().toISOString();
  }

  async downloadSigned(envelopeId: string) {
    const e = this.get(envelopeId);
    if (e.status !== "signed") throw new Error("envelope is not signed");
    const enc = new TextEncoder();
    return {
      pdf: enc.encode(`%PDF-MOCK signed ${envelopeId}\n${e.input.documentText}`),
      auditCertificate: enc.encode(`%PDF-MOCK certificate ${envelopeId} signer=${e.input.signer.email}`),
    };
  }

  reminderCount(envelopeId: string): number {
    return this.get(envelopeId).reminders;
  }

  /** Simulates the client opening the document; returns the signed webhook body. */
  simulateView(envelopeId: string, at = this.clock()) {
    this.get(envelopeId).status = "viewed";
    return this.webhookFor(envelopeId, "viewed", at);
  }

  /** Simulates the client signing; returns the signed webhook body. */
  simulateSign(envelopeId: string, at = this.clock()) {
    this.get(envelopeId).status = "signed";
    return this.webhookFor(envelopeId, "signed", at);
  }

  webhookFor(envelopeId: string, status: EnvelopeStatus, at = this.clock()) {
    const rawBody = JSON.stringify({ envelopeId, status, at: at.toISOString() });
    return { rawBody, headers: { "x-mock-signature": hmac(this.secret, rawBody, "hex") } };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): EsignWebhookEvent[] {
    const sig = lowerHeaders(headers)["x-mock-signature"];
    if (!sig || !safeEqual(sig, hmac(this.secret, rawBody, "hex"))) throw new WebhookSignatureError();
    const body = JSON.parse(rawBody) as EsignWebhookEvent;
    return [{ envelopeId: body.envelopeId, status: body.status, at: body.at }];
  }
}
