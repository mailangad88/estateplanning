/**
 * LawPay-shaped payment adapter (stub). LawPay keeps operating and trust (IOLTA) deposits in
 * separate merchant accounts, so every request names which one the money goes to. The request
 * and webhook shapes below are written from memory of the LawPay/AffiniPay API and are NOT
 * verified: confirm endpoints, field names, the signature header and refund semantics against
 * the provider documentation (and a sandbox account) before launch. Not exercised against the
 * network in tests; tests inject `fetchImpl`.
 *
 * The constructor refuses to run without every credential, so production cannot start with a
 * half-configured processor. Amounts are integer cents both ways.
 */
import type { PaymentLinkInput, PaymentProvider, PaymentWebhookEvent, RefundInput } from "@/server/esign/payments";
import { hmac, lowerHeaders, safeEqual, WebhookSignatureError } from "@/server/esign/provider";

export interface LawPayConfig {
  secretKey: string;
  operatingAccountId: string;
  trustAccountId: string;
  /** Shared secret for the webhook HMAC */
  webhookSecret: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const STATUS_MAP: Record<string, PaymentWebhookEvent["status"]> = {
  "payment.succeeded": "paid", // verify against provider docs before launch
  "payment.failed": "failed",
  "refund.succeeded": "refunded",
};

export class LawPayProvider implements PaymentProvider {
  readonly name = "lawpay";
  private readonly f: typeof fetch;
  private readonly base: string;

  constructor(private readonly cfg: LawPayConfig) {
    for (const k of ["secretKey", "operatingAccountId", "trustAccountId", "webhookSecret"] as const) {
      if (!cfg[k]) throw new Error(`LawPay is not configured: ${k} is missing`);
    }
    this.f = cfg.fetchImpl ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.lawpay.com/v1"; // verify against provider docs before launch
  }

  private accountId(account: "operating" | "trust"): string {
    return account === "trust" ? this.cfg.trustAccountId : this.cfg.operatingAccountId;
  }

  private async call(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await this.f(`${this.base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LawPay request failed (${res.status})`);
    return (await res.json()) as Record<string, unknown>;
  }

  async createPaymentLink(input: PaymentLinkInput) {
    const out = await this.call("/payment_links", {
      account_id: this.accountId(input.account),
      amount: input.amountCents,
      currency: "usd",
      description: input.description,
      metadata: { engagement_id: input.engagementId, installment_no: input.installmentNo ?? null, due_on: input.dueOn ?? null },
    });
    const id = out.id;
    const url = out.url;
    if (typeof id !== "string" || typeof url !== "string") throw new Error("LawPay returned an unexpected payment link response");
    return { paymentId: id, url };
  }

  async refund(input: RefundInput) {
    const out = await this.call(`/payments/${encodeURIComponent(input.paymentId)}/refunds`, { amount: input.amountCents, reason: input.reason });
    if (typeof out.id !== "string") throw new Error("LawPay returned an unexpected refund response");
    return { refundId: out.id };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): PaymentWebhookEvent[] {
    const sig = lowerHeaders(headers)["x-lawpay-signature"]; // verify header name against provider docs before launch
    if (!sig || !safeEqual(sig, hmac(this.cfg.webhookSecret, rawBody, "hex"))) throw new WebhookSignatureError();
    const body = JSON.parse(rawBody) as {
      type?: string;
      created_at?: string;
      data?: { payment_id?: string; refund_id?: string; amount?: number; metadata?: { engagement_id?: string } };
    };
    const status = body.type ? STATUS_MAP[body.type] : undefined;
    const d = body.data;
    if (!status || !d?.payment_id || !d.metadata?.engagement_id) return []; // an event type we do not act on
    return [
      {
        paymentId: d.payment_id,
        engagementId: d.metadata.engagement_id,
        status,
        at: body.created_at ?? new Date().toISOString(),
        amountCents: typeof d.amount === "number" ? d.amount : undefined,
        refundId: d.refund_id,
      },
    ];
  }
}
