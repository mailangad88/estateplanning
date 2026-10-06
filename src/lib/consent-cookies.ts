export const CONSENT_KEY = "efp-consent";

export type ConsentChoice = { v: 1; analytics: boolean; ads: boolean; at: string };

export type ConsentUpdate = {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
};

export function makeChoice(analytics: boolean, ads: boolean, now: Date = new Date()): ConsentChoice {
  return { v: 1, analytics, ads, at: now.toISOString() };
}

/** Parses a stored value. Returns null for anything missing, malformed or from another version. */
export function parseChoice(raw: string | null | undefined): ConsentChoice | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || typeof d.analytics !== "boolean" || typeof d.ads !== "boolean") return null;
  if (typeof d.at !== "string" || Number.isNaN(Date.parse(d.at))) return null;
  return { v: 1, analytics: d.analytics, ads: d.ads, at: d.at };
}

/** Builds the gtag consent object. Global Privacy Control forces the advertising signals to denied. */
export function toConsentUpdate(choice: ConsentChoice, gpc: boolean): ConsentUpdate {
  const ads = choice.ads && !gpc ? "granted" : "denied";
  return {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: choice.analytics ? "granted" : "denied",
  };
}
