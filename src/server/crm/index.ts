import type { CrmAdapter } from "@/server/crm/adapter";
import { HubSpotAdapter } from "@/server/crm/hubspot";
import { LawmaticsAdapter } from "@/server/crm/lawmatics";
import { MockCrmAdapter } from "@/server/crm/mock";

/**
 * Chooses the CRM from env. A missing token falls back to the mock so local dev works,
 * but production refuses to start syncing into nothing unless CRM_ALLOW_MOCK=true,
 * because a silent mock would drop every lead from the real CRM.
 */
export function crmAdapterFromEnv(env: Record<string, string | undefined> = process.env): CrmAdapter {
  const provider = (env.CRM_PROVIDER ?? "lawmatics").toLowerCase();
  if (provider !== "lawmatics" && provider !== "hubspot" && provider !== "mock") {
    throw new Error(`Unknown CRM_PROVIDER "${provider}"`);
  }
  if (provider === "lawmatics" && env.LAWMATICS_API_TOKEN) return new LawmaticsAdapter({ token: env.LAWMATICS_API_TOKEN });
  if (provider === "hubspot" && env.HUBSPOT_PRIVATE_APP_TOKEN) {
    return new HubSpotAdapter({ token: env.HUBSPOT_PRIVATE_APP_TOKEN, pipelineId: env.HUBSPOT_PIPELINE_ID });
  }
  if (env.NODE_ENV === "production" && env.CRM_ALLOW_MOCK !== "true") {
    throw new Error(`CRM "${provider}" is not configured (missing token). Set CRM_ALLOW_MOCK=true to run with the mock in production.`);
  }
  return new MockCrmAdapter();
}

export { CrmSync } from "@/server/crm/sync";
export type { CrmAdapter } from "@/server/crm/adapter";
