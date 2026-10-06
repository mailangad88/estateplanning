import { DocusignProvider } from "@/server/esign/docusign";
import { DropboxSignProvider } from "@/server/esign/dropboxsign";
import { MockEsignProvider } from "@/server/esign/mock";
import type { EsignProvider } from "@/server/esign/provider";

type Env = Record<string, string | undefined>;

/**
 * Picks the e-sign provider from the environment. Missing credentials fall back
 * to the mock, but never silently in production: a mock "signature" is not a
 * signed retainer, so production refuses unless ESIGN_ALLOW_MOCK=true.
 */
export function esignProviderFromEnv(env: Env = process.env): EsignProvider {
  const wanted = (env.ESIGN_PROVIDER ?? "mock").toLowerCase();
  let provider: EsignProvider | undefined;

  if (wanted === "docusign" && env.DOCUSIGN_ACCOUNT_ID && env.DOCUSIGN_ACCESS_TOKEN && env.DOCUSIGN_BASE_URI && env.DOCUSIGN_HMAC_KEY) {
    provider = new DocusignProvider({
      accountId: env.DOCUSIGN_ACCOUNT_ID,
      accessToken: env.DOCUSIGN_ACCESS_TOKEN,
      baseUri: env.DOCUSIGN_BASE_URI,
      hmacKey: env.DOCUSIGN_HMAC_KEY,
    });
  } else if (wanted === "dropboxsign" && env.DROPBOXSIGN_API_KEY) {
    provider = new DropboxSignProvider({ apiKey: env.DROPBOXSIGN_API_KEY, testMode: env.DROPBOXSIGN_TEST_MODE === "true" });
  }

  if (provider) return provider;
  if (env.NODE_ENV === "production" && env.ESIGN_ALLOW_MOCK !== "true") {
    throw new Error("E-sign provider is not configured. Set ESIGN_PROVIDER and its credentials, or ESIGN_ALLOW_MOCK=true to override.");
  }
  return new MockEsignProvider(env.ESIGN_MOCK_SECRET);
}
