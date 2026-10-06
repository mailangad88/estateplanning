/**
 * Who sends the nurture messages: this app ("internal", the default, dry-run until live) or the
 * firm's CRM ("crm", opt-in). In "crm" mode we only push state (see crm/nurtureState.ts) and
 * create call tasks; the CRM's own automations send the email and SMS.
 */
export type NurtureOwner = "crm" | "internal";

/** True when a real CRM (not the mock) has its token set. Mirrors crmAdapterFromEnv without building one. */
export function liveCrmConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const provider = (env.CRM_PROVIDER ?? "lawmatics").toLowerCase();
  return (provider === "lawmatics" && !!env.LAWMATICS_API_TOKEN) || (provider === "hubspot" && !!env.HUBSPOT_PRIVATE_APP_TOKEN);
}

/**
 * NURTURE_OWNER=crm only takes effect with a live CRM adapter: with the mock or no token, handing
 * sends to a CRM that is not there would silently stop all follow-up, so it stays "internal".
 */
export function nurtureOwnerFromEnv(env: Record<string, string | undefined> = process.env): NurtureOwner {
  const raw = (env.NURTURE_OWNER ?? "").trim().toLowerCase();
  if (raw && raw !== "crm" && raw !== "internal") throw new Error(`Unknown NURTURE_OWNER "${raw}" (use crm or internal)`);
  return raw === "crm" && liveCrmConfigured(env) ? "crm" : "internal";
}
