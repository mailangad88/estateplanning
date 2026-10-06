/**
 * Provider-agnostic e-signature contract. The engagement flow only talks to this
 * interface, so DocuSign, Dropbox Sign or the in-memory mock can be swapped by
 * configuration. Webhooks are the source of truth for status, which is why
 * parseWebhook must verify the signature itself rather than trusting the caller.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type EnvelopeStatus = "sent" | "viewed" | "signed" | "declined" | "voided";

export interface CreateEnvelopeInput {
  engagementId: string;
  signer: { name: string; email: string; phone: string };
  documentTitle: string;
  documentText: string;
  /** Second factor for the signer: a one-time code by text message before signing */
  requireSmsCode: boolean;
  language: string;
  redirectUrl?: string;
}

export interface EsignWebhookEvent {
  envelopeId: string;
  status: EnvelopeStatus;
  at: string;
}

export interface EsignProvider {
  readonly name: string;
  createEnvelope(input: CreateEnvelopeInput): Promise<{ envelopeId: string; signingUrl?: string }>;
  getStatus(envelopeId: string): Promise<{ status: EnvelopeStatus; at: string }>;
  sendReminder(envelopeId: string): Promise<void>;
  voidEnvelope(envelopeId: string, reason: string): Promise<void>;
  downloadSigned(envelopeId: string): Promise<{ pdf: Uint8Array; auditCertificate: Uint8Array }>;
  /** Verifies the signature (throws on a bad one) and returns normalized events. */
  parseWebhook(rawBody: string, headers: Record<string, string>): EsignWebhookEvent[];
}

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export function lowerHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
}

/** Constant-time string comparison, so signature checks do not leak timing. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function hmac(secret: string, data: string, encoding: "hex" | "base64"): string {
  return createHmac("sha256", secret).update(data).digest(encoding);
}
