import { CONVERSION_PROVIDERS } from "@/server/conversions/events";
import { exportConversionsCsv } from "@/server/conversions/sweep";
import { withActor } from "@/server/http";
import type { ConversionProvider } from "@/server/types";

type IdKind = "gclid" | "gbraid" | "wbraid";

function params(provider: string | null, idKind: string | null) {
  if (!CONVERSION_PROVIDERS.includes(provider as ConversionProvider)) throw new Error("provider must be google_ads or meta");
  if (idKind && !["gclid", "gbraid", "wbraid"].includes(idKind)) throw new Error("idKind must be gclid, gbraid or wbraid");
  return { provider: provider as ConversionProvider, idKind: (idKind ?? undefined) as IdKind | undefined };
}

function csvResponse(out: { csv: string; filename: string; count: number }) {
  return new Response(out.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${out.filename}"`,
      "x-row-count": String(out.count),
      "cache-control": "no-store",
    },
  });
}

/** GET /api/admin/conversions/export?provider=google_ads&idKind=gclid: a CSV of unsent conversions. Changes nothing. */
export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const url = new URL(request.url);
    const p = params(url.searchParams.get("provider"), url.searchParams.get("idKind"));
    return csvResponse(await exportConversionsCsv(db, actor, p.provider, { idKind: p.idKind }));
  });
}

/** POST { provider, idKind }: the same CSV, and the rows are recorded as sent by manual upload so they are not sent twice. */
export async function POST(request: Request) {
  return withActor(request, async ({ db, actor, request }) => {
    const body = (await request.json().catch(() => ({}))) as { provider?: string; idKind?: string };
    const p = params(body.provider ?? null, body.idKind ?? null);
    return csvResponse(await exportConversionsCsv(db, actor, p.provider, { idKind: p.idKind, markSent: true }));
  });
}
