/**
 * Payment provider contract for the engagement fee. Legal fees go from the client
 * straight to the firm's own account (LawPay, Clio Payments or Stripe connected
 * to the firm), never through the platform: the platform only creates the link
 * and learns the outcome by webhook. `account` picks operating vs trust (IOLTA)
 * according to the flat-fee treatment the attorney chose.
 */
import { hmac, lowerHeaders, safeEqual, WebhookSignatureError } from "@/server/esign/provider";

export interface PaymentLinkInput {
  engagementId: string;
  amountCents: number;
  description: string;
  account: "operating" | "trust";
}

export interface PaymentWebhookEvent {
  paymentId: string;
  /** Echoed from the link metadata so the webhook can be matched without extra storage */
  engagementId: string;
  status: "paid" | "failed";
  at: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(input: PaymentLinkInput): Promise<{ paymentId: string; url: string }>;
  /** Verifies the signature (throws on a bad one). */
  parseWebhook(rawBody: string, headers: Record<string, string>): PaymentWebhookEvent[];
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly links = new Map<string, PaymentLinkInput>();
  private counter = 0;

  constructor(private readonly secret = "mock-payment-secret") {}

  async createPaymentLink(input: PaymentLinkInput) {
    const paymentId = `mock-pay-${++this.counter}`;
    this.links.set(paymentId, input);
    return { paymentId, url: `https://pay.mock.local/${paymentId}` };
  }

  webhookFor(paymentId: string, status: "paid" | "failed", at = new Date()) {
    const link = this.links.get(paymentId);
    if (!link) throw new Error(`unknown payment ${paymentId}`);
    const rawBody = JSON.stringify({ paymentId, engagementId: link.engagementId, status, at: at.toISOString() });
    return { rawBody, headers: { "x-mock-signature": hmac(this.secret, rawBody, "hex") } };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): PaymentWebhookEvent[] {
    const sig = lowerHeaders(headers)["x-mock-signature"];
    if (!sig || !safeEqual(sig, hmac(this.secret, rawBody, "hex"))) throw new WebhookSignatureError();
    return [JSON.parse(rawBody) as PaymentWebhookEvent];
  }
}

/**
 * Picks the payment provider. Only the mock exists until the firm's processor
 * (LawPay, Clio Payments or Stripe on the firm's account) is chosen; production
 * refuses the mock unless PAYMENTS_ALLOW_MOCK=true.
 */
export function paymentProviderFromEnv(env: Record<string, string | undefined> = process.env): PaymentProvider {
  if (env.NODE_ENV === "production" && env.PAYMENTS_ALLOW_MOCK !== "true") {
    throw new Error("Payment provider is not configured. Connect the firm's processor, or set PAYMENTS_ALLOW_MOCK=true to override.");
  }
  const g = globalThis as unknown as { __epMockPay?: MockPaymentProvider };
  g.__epMockPay ??= new MockPaymentProvider(env.PAYMENTS_MOCK_SECRET);
  return g.__epMockPay;
}
