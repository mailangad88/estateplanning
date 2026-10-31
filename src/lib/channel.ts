/**
 * Which channel a lead came from, worked out from the landing referrer and campaign tags, so the CRM can
 * report leads from Google organic, Bing, AI assistants (ChatGPT, Perplexity, Claude, Gemini, Copilot) and
 * paid ads without anyone reading raw referrer URLs. Paid tags win over the referrer.
 */
export type Channel =
  | "paid_search" | "paid_social" | "email" | "partner"
  | "ai_assistant" | "organic_search" | "social" | "referral" | "direct";

const AI_HOSTS: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/, "gemini"],
  [/(^|\.)copilot\.microsoft\.com$/, "copilot"],
  [/(^|\.)you\.com$|(^|\.)phind\.com$|(^|\.)meta\.ai$|(^|\.)deepseek\.com$|(^|\.)grok\.com$/, "other_ai"],
];
const SEARCH_HOSTS: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)search\.brave\.com$/, "brave"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
];
const SOCIAL_HOSTS = /(^|\.)(facebook|instagram|youtube|linkedin|tiktok|reddit|pinterest|x|twitter|nextdoor|threads)\.(com|net)$|(^|\.)t\.co$|(^|\.)lnkd\.in$|(^|\.)youtu\.be$/;

export interface ChannelInput {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  partnerRef?: string;
}

function host(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Returns the channel and, where known, the specific engine or assistant (e.g. organic_search / google). */
export function leadChannel(s: ChannelInput, ownHost?: string): { channel: Channel; engine: string } {
  const medium = (s.utmMedium ?? "").toLowerCase();
  const src = (s.utmSource ?? "").toLowerCase();
  if (s.gclid || s.gbraid || s.wbraid || /^(cpc|ppc|paid[-_ ]?search|sem)$/.test(medium)) return { channel: "paid_search", engine: src || "google" };
  if (/^(paid[-_ ]?social|social[-_ ]?paid|cpm)$/.test(medium)) return { channel: "paid_social", engine: src };
  if (medium === "email" || medium === "newsletter") return { channel: "email", engine: src };
  if (s.partnerRef) return { channel: "partner", engine: s.partnerRef };
  // ChatGPT adds utm_source=chatgpt.com to links it cites.
  for (const [re, name] of AI_HOSTS) if (re.test(src)) return { channel: "ai_assistant", engine: name };
  if (s.fbclid) return { channel: "social", engine: "facebook" };
  const h = host(s.referrer);
  if (!h || (ownHost && h === ownHost.replace(/^www\./, ""))) return { channel: "direct", engine: "" };
  for (const [re, name] of AI_HOSTS) if (re.test(h)) return { channel: "ai_assistant", engine: name };
  for (const [re, name] of SEARCH_HOSTS) if (re.test(h)) return { channel: "organic_search", engine: name };
  if (SOCIAL_HOSTS.test(h)) return { channel: "social", engine: h.split(".").slice(-2, -1)[0] ?? h };
  return { channel: "referral", engine: h };
}
