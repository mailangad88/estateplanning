/**
 * IndexNow key file (https://www.indexnow.org). scripts/indexnow.mjs submits URLs with
 * keyLocation pointing here. Set INDEXNOW_KEY (8-128 hex characters) in the hosting environment.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
