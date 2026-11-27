import indexnow from "@/config/indexnow.json";

/**
 * IndexNow key file (https://www.indexnow.org). scripts/indexnow.mjs submits URLs with keyLocation pointing
 * here. The key is public by design; INDEXNOW_KEY (8-128 hex characters) in the environment overrides the
 * committed one in src/config/indexnow.json.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.INDEXNOW_KEY || indexnow.key;
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
