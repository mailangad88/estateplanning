import { NextResponse } from "next/server";
import { esignProviderFromEnv } from "@/server/esign";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { handleEsignWebhook } from "@/server/services/engagement";
import { getDb } from "@/server/runtime";

/** E-sign provider callbacks. The provider adapter verifies the signature before anything changes. */
export async function POST(request: Request) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  try {
    // The payment link goes out as soon as the retainer is signed. If no payment provider is configured the
    // cron sweep (issueDueLinks) sends it later, so a signature is never lost over a payments setting.
    let payments: ReturnType<typeof paymentProviderFromEnv> | undefined;
    try {
      payments = paymentProviderFromEnv();
    } catch {
      payments = undefined;
    }
    const result = await handleEsignWebhook(await getDb(), esignProviderFromEnv(), raw, headers, new Date(), undefined, payments);
    return NextResponse.json(result);
  } catch (err) {
    console.warn("esign webhook rejected", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "rejected" }, { status: 400 });
  }
}
