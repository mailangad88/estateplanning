import { BuiltinEsignProvider, builtinSecret } from "@/server/esign/builtin";
import { DocusignProvider } from "@/server/esign/docusign";
import { DropboxSignProvider } from "@/server/esign/dropboxsign";
import { MockEsignProvider } from "@/server/esign/mock";
import type { EsignProvider } from "@/server/esign/provider";

type Env = Record<string, string | undefined>;

/**
 * Picks the e-sign provider from the environment. The built-in e-sign (no third party, no fee) is the default
 * everywhere. DocuSign and Dropbox Sign are optional adapters, used only when named with all of their
 * credentials (unverified against the live APIs). A named provider with missing credentials falls back to the
 * built-in one in development and is refused in production, so a misconfiguration is never silent there.
 * The mock is for tests: ESIGN_PROVIDER=mock, and never in production unless ESIGN_ALLOW_MOCK=true.
 */
export function esignProviderFromEnv(env: Env = process.env): EsignProvider {
  const wanted = (env.ESIGN_PROVIDER ?? "builtin").toLowerCase();
  const production = env.NODE_ENV === "production";

  if (wanted === "docusign" && env.DOCUSIGN_ACCOUNT_ID && env.DOCUSIGN_ACCESS_TOKEN && env.DOCUSIGN_BASE_URI && env.DOCUSIGN_HMAC_KEY) {
    return new DocusignProvider({
      accountId: env.DOCUSIGN_ACCOUNT_ID,
      accessToken: env.DOCUSIGN_ACCESS_TOKEN,
      baseUri: env.DOCUSIGN_BASE_URI,
      hmacKey: env.DOCUSIGN_HMAC_KEY,
    });
  }
  if (wanted === "dropboxsign" && env.DROPBOXSIGN_API_KEY) {
    return new DropboxSignProvider({ apiKey: env.DROPBOXSIGN_API_KEY, testMode: env.DROPBOXSIGN_TEST_MODE === "true" });
  }
  if (wanted === "mock") {
    if (production && env.ESIGN_ALLOW_MOCK !== "true") {
      throw new Error("The mock e-sign provider is for tests. Use ESIGN_PROVIDER=builtin (the default), or ESIGN_ALLOW_MOCK=true to override.");
    }
    // One mock per process so envelopes created by one request are there for the webhook that follows.
    const g = globalThis as unknown as { __epMockEsign?: MockEsignProvider };
    g.__epMockEsign ??= new MockEsignProvider(env.ESIGN_MOCK_SECRET);
    return g.__epMockEsign;
  }
  if (wanted !== "builtin" && production) {
    throw new Error(`E-sign provider "${wanted}" is not configured. Set its credentials, or ESIGN_PROVIDER=builtin.`);
  }
  return new BuiltinEsignProvider(builtinSecret(env), undefined, env.APP_URL ?? "http://localhost:3000");
}
