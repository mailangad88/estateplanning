import { NextResponse } from "next/server";
import { esignProviderFromEnv } from "@/server/esign";
import { handleEsignWebhook } from "@/server/services/engagement";
import { getDb } from "@/server/runtime";

/** E-sign provider callbacks. The provider adapter verifies the signature before anything changes. */
export async function POST(request: Request) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  try {
    const result = await handleEsignWebhook(getDb(), esignProviderFromEnv(), raw, headers, new Date());
    return NextResponse.json(result);
  } catch (err) {
    console.warn("esign webhook rejected", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "rejected" }, { status: 400 });
  }
}
