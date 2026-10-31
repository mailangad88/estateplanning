/**
 * The built-in e-sign: no third-party service, no per-envelope fee. The client signs on /client/sign/[id]
 * after signing in to their client portal; src/server/services/signing.ts records each signature
 * (insert-only) and then feeds a signed "signed" event through the same handleEsignWebhook path every
 * provider uses, so the stage change, stored copy, payment plan and audit are identical.
 *
 * State lives in the platform's own tables, so the methods that need it take the EsignContext. Events are
 * HMAC-signed with a server secret, so a forged POST to /api/webhooks/esign is rejected like any other.
 * Reminders go out through the email transport, which is a dry run (logged, not sent) unless
 * OUTBOUND_SEND_MODE=live.
 */
import { createHash } from "node:crypto";
import { firm as firmConfig } from "@/config/firm";
import { emailTransportFromEnv, type EmailTransport } from "@/server/notify/transports";
import { renderCertificateHtml, renderSignedCopyHtml, type SignedCopyInput } from "@/server/esign/signedCopy";
import {
  hmac,
  lowerHeaders,
  safeEqual,
  WebhookSignatureError,
  type CreateEnvelopeInput,
  type EnvelopeStatus,
  type EsignContext,
  type EsignProvider,
  type EsignWebhookEvent,
  type SignedFiles,
} from "@/server/esign/provider";
import type { Db } from "@/server/db";
import type { Engagement } from "@/server/types";

type Env = Record<string, string | undefined>;

export const BUILTIN_PREFIX = "builtin-";
export const signingPath = (engagementId: string) => `/client/sign/${engagementId}`;

/** ESIGN_BUILTIN_SECRET, else derived from SESSION_SECRET. Production needs one of them. */
export function builtinSecret(env: Env = process.env): string {
  if (env.ESIGN_BUILTIN_SECRET && env.ESIGN_BUILTIN_SECRET.length >= 32) return env.ESIGN_BUILTIN_SECRET;
  const s = env.SESSION_SECRET;
  if (s && s.length >= 32) return createHash("sha256").update(`esign-builtin:${s}`).digest("hex");
  if (env.NODE_ENV === "production") throw new Error("Set ESIGN_BUILTIN_SECRET or SESSION_SECRET (32+ characters) for the built-in e-sign");
  return "development-only-builtin-esign-secret";
}

const letterHash = (e: Engagement) => createHash("sha256").update(e.letter ?? "").digest("hex");

/** Everything the signed copy needs, read from the platform's records. */
export async function signedCopyInput(db: Db, e: Engagement): Promise<SignedCopyInput> {
  const signatures = (await db.signatures.list(undefined, { engagementId: e.id })).sort((a, b) => a.signedAt.localeCompare(b.signedAt));
  const firmRow = await db.firms.get(e.firmId);
  const lawyer = await db.lawyers.get(e.lawyerId);
  return {
    engagement: e,
    signatures,
    firmName: firmRow?.name ?? firmConfig.firmLegalName,
    attorneyName: lawyer?.name ?? firmConfig.attorneyName,
    countersignedAt: e.history.find((h) => h.status === "countersigned")?.at,
    letterSha256: letterHash(e),
  };
}

export class BuiltinEsignProvider implements EsignProvider {
  readonly name = "builtin";

  constructor(
    private readonly secret: string = builtinSecret(),
    private readonly email: () => EmailTransport = () => emailTransportFromEnv(),
    private readonly baseUrl: string = process.env.APP_URL ?? "http://localhost:3000",
  ) {}

  async createEnvelope(input: CreateEnvelopeInput) {
    return { envelopeId: `${BUILTIN_PREFIX}${input.engagementId}`, signingUrl: signingPath(input.engagementId) };
  }

  private async engagementFor(envelopeId: string, ctx?: EsignContext): Promise<Engagement> {
    if (!ctx) throw new Error("the built-in e-sign needs the store");
    const e = (await ctx.db.engagements.list(undefined, { providerEnvelopeId: envelopeId }))[0];
    if (!e) throw new Error(`unknown envelope ${envelopeId}`);
    return e;
  }

  async getStatus(envelopeId: string, ctx?: EsignContext): Promise<{ status: EnvelopeStatus; at: string }> {
    const e = await this.engagementFor(envelopeId, ctx);
    const last = e.history[e.history.length - 1];
    const status: EnvelopeStatus = e.status === "voided" ? "voided" : ["signed", "paid", "countersigned"].includes(e.status) ? "signed" : e.status === "viewed" ? "viewed" : "sent";
    return { status, at: last?.at ?? new Date().toISOString() };
  }

  /** A short reminder with the link to the client's sign-in. No case details in the message. */
  async sendReminder(envelopeId: string, ctx?: EsignContext): Promise<void> {
    const e = await this.engagementFor(envelopeId, ctx);
    const lead = await ctx!.db.leads.get(e.leadId);
    const person = lead ? await ctx!.db.persons.get(lead.personId) : undefined;
    if (!person?.email) return;
    const link = `${this.baseUrl.replace(/\/$/, "")}${signingPath(e.id)}`;
    await this.email().send({
      to: person.email,
      subject: "Your engagement agreement is ready to sign",
      text: `Hello ${person.firstName},\n\nYour attorney's office sent you an engagement agreement to review and sign. It takes about five minutes.\n\nOpen it here (you will be asked to sign in): ${link}\n\nQuestions? Reply to this email or call the office.`,
      stream: "transactional",
      tag: "engagement-reminder",
    });
  }

  async voidEnvelope(): Promise<void> {
    // Nothing to cancel elsewhere: a voided engagement can no longer be signed (signing.ts checks the status).
  }

  async downloadSigned(envelopeId: string, ctx?: EsignContext): Promise<SignedFiles> {
    const e = await this.engagementFor(envelopeId, ctx);
    const input = await signedCopyInput(ctx!.db, e);
    if (input.signatures.length === 0) throw new Error("envelope is not signed");
    const enc = new TextEncoder();
    return {
      pdf: enc.encode(renderSignedCopyHtml(input)),
      auditCertificate: enc.encode(renderCertificateHtml(input)),
      contentType: "text/html",
      extension: "html",
    };
  }

  /** A signed event body for handleEsignWebhook. Only the server can make one. */
  eventFor(envelopeId: string, status: EnvelopeStatus, at: Date) {
    const rawBody = JSON.stringify({ provider: "builtin", envelopeId, status, at: at.toISOString() });
    return { rawBody, headers: { "x-builtin-signature": hmac(this.secret, rawBody, "hex") } };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): EsignWebhookEvent[] {
    const sig = lowerHeaders(headers)["x-builtin-signature"];
    if (!sig || !safeEqual(sig, hmac(this.secret, rawBody, "hex"))) throw new WebhookSignatureError();
    const body = JSON.parse(rawBody) as EsignWebhookEvent & { provider?: string };
    if (body.provider !== "builtin" || !body.envelopeId?.startsWith(BUILTIN_PREFIX)) throw new WebhookSignatureError("Not a built-in e-sign event");
    return [{ envelopeId: body.envelopeId, status: body.status, at: body.at }];
  }
}
