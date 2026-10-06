import { NextResponse } from "next/server";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { handlePaymentWebhook } from "@/server/services/engagement";
import { getDb } from "@/server/runtime";

export async function POST(request: Request) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  try {
    return NextResponse.json(await handlePaymentWebhook(getDb(), paymentProviderFromEnv(), raw, headers, new Date()));
  } catch (err) {
    console.warn("payment webhook rejected", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "rejected" }, { status: 400 });
  }
}
