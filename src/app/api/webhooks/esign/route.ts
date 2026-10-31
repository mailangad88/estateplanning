import { NextResponse } from "next/server";
import { esignProviderFromEnv } from "@/server/esign";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { handleEsignWebhook } from "@/server/services/engagement";
import { getDb } from "@/server/runtime";
import { putBlob } from "@/server/storage/blobs";

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
    const db = await getDb();
    const now = new Date();
    // Signed copies are kept in the platform's own store (stored_blobs), keyed by engagement.
    const store = (key: string, bytes: Uint8Array) =>
      putBlob(db, { key, bytes, contentType: key.endsWith(".pdf") ? "application/pdf" : "text/html", createdBy: "system" }, now).then(() => undefined);
    const result = await handleEsignWebhook(db, esignProviderFromEnv(), raw, headers, now, store, payments);
    return NextResponse.json(result);
  } catch (err) {
    console.warn("esign webhook rejected", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "rejected" }, { status: 400 });
  }
}
