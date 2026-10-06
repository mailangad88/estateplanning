/**
 * Payment provider contract for the engagement fee. Legal fees go from the client
 * straight to the firm's own account (LawPay, Clio Payments or Stripe connected
 * to the firm), never through the platform: the platform only creates the link
 * and learns the outcome by webhook. `account` picks operating vs trust (IOLTA)
 * according to the firm's configured flat-fee treatment (src/config/firm.ts).
 */
import { LawPayProvider } from "@/server/esign/lawpay";
import { hmac, lowerHeaders, safeEqual, WebhookSignatureError } from "@/server/esign/provider";

export interface PaymentLinkInput {
  engagementId: string;
  amountCents: number;
  description: string;
  account: "operating" | "trust";
  /** Which installment of the plan this pays, for the processor's records */
  installmentNo?: number;
  /** Date the payment is due, YYYY-MM-DD */
  dueOn?: string;
}

export interface PaymentWebhookEvent {
  paymentId: string;
  /** Echoed from the link metadata so the webhook can be matched without extra storage */
  engagementId: string;
  status: "paid" | "failed" | "refunded";
  at: string;
  /** Amount the processor actually took (paid) or returned (refunded). The service checks it against the schedule. */
  amountCents?: number;
  /** Required for "refunded": the processor's refund id, so a replayed event is not counted twice */
  refundId?: string;
}

export interface RefundInput {
  paymentId: string;
  amountCents: number;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(input: PaymentLinkInput): Promise<{ paymentId: string; url: string }>;
  /** Verifies the signature (throws on a bad one). */
  parseWebhook(rawBody: string, headers: Record<string, string>): PaymentWebhookEvent[];
  /** Asks the processor to return money to the client from the account the payment went to. */
  refund(input: RefundInput): Promise<{ refundId: string }>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly links = new Map<string, PaymentLinkInput>();
  readonly refunds: (RefundInput & { refundId: string })[] = [];
  private counter = 0;

  constructor(private readonly secret = "mock-payment-secret") {}

  async createPaymentLink(input: PaymentLinkInput) {
    const paymentId = `mock-pay-${++this.counter}`;
    this.links.set(paymentId, input);
    return { paymentId, url: `https://pay.mock.local/${paymentId}` };
  }

  async refund(input: RefundInput) {
    if (!this.links.has(input.paymentId)) throw new Error(`unknown payment ${input.paymentId}`);
    const refundId = `mock-refund-${this.refunds.length + 1}`;
    this.refunds.push({ ...input, refundId });
    return { refundId };
  }

  /** A correctly signed webhook body. Pass `extra` to override fields such as amountCents or refundId. */
  webhookFor(paymentId: string, status: PaymentWebhookEvent["status"], at = new Date(), extra: Partial<PaymentWebhookEvent> = {}) {
    const link = this.links.get(paymentId);
    if (!link) throw new Error(`unknown payment ${paymentId}`);
    const rawBody = JSON.stringify({ paymentId, engagementId: link.engagementId, status, at: at.toISOString(), amountCents: link.amountCents, ...extra });
    return { rawBody, headers: { "x-mock-signature": hmac(this.secret, rawBody, "hex") } };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): PaymentWebhookEvent[] {
    const sig = lowerHeaders(headers)["x-mock-signature"];
    if (!sig || !safeEqual(sig, hmac(this.secret, rawBody, "hex"))) throw new WebhookSignatureError();
    return [JSON.parse(rawBody) as PaymentWebhookEvent];
  }
}

/**
 * Picks the payment provider. LawPay is selected with PAYMENTS_PROVIDER=lawpay and all of its
 * credentials; the mock is the default outside production. Production refuses the mock unless
 * PAYMENTS_ALLOW_MOCK=true, and refuses a named provider whose credentials are missing, because a
 * mock "payment" is not money in the firm's account.
 */
export function paymentProviderFromEnv(env: Record<string, string | undefined> = process.env): PaymentProvider {
  const wanted = (env.PAYMENTS_PROVIDER ?? "mock").toLowerCase();
  if (wanted === "lawpay" && env.LAWPAY_SECRET_KEY && env.LAWPAY_OPERATING_ACCOUNT_ID && env.LAWPAY_TRUST_ACCOUNT_ID && env.LAWPAY_WEBHOOK_SECRET) {
    return new LawPayProvider({
      secretKey: env.LAWPAY_SECRET_KEY,
      operatingAccountId: env.LAWPAY_OPERATING_ACCOUNT_ID,
      trustAccountId: env.LAWPAY_TRUST_ACCOUNT_ID,
      webhookSecret: env.LAWPAY_WEBHOOK_SECRET,
      baseUrl: env.LAWPAY_BASE_URL,
    });
  }
  if (env.NODE_ENV === "production" && env.PAYMENTS_ALLOW_MOCK !== "true") {
    throw new Error("Payment provider is not configured. Set PAYMENTS_PROVIDER=lawpay and its LAWPAY_* credentials, or PAYMENTS_ALLOW_MOCK=true to override.");
  }
  const g = globalThis as unknown as { __epMockPay?: MockPaymentProvider };
  g.__epMockPay ??= new MockPaymentProvider(env.PAYMENTS_MOCK_SECRET);
  return g.__epMockPay;
}
