/**
 * Dynamic number insertion (B5). Pure logic, no browser access, so it can be unit tested.
 * The browser side (first-touch memory in sessionStorage) lives in `components/TrackedPhone.tsx`.
 */

export interface FirstTouch {
  source?: string;
  medium?: string;
}

/** Normalizes campaign parameters into a first-touch source. Click ids stand in for missing UTMs. */
export function firstTouchFromParams(params: URLSearchParams): FirstTouch | null {
  const source = params.get("utm_source")?.trim().toLowerCase() || undefined;
  const medium = params.get("utm_medium")?.trim().toLowerCase() || undefined;
  if (source || medium) return { source, medium };
  if (params.get("gclid") || params.get("gbraid") || params.get("wbraid")) return { source: "google", medium: "cpc" };
  if (params.get("msclkid")) return { source: "bing", medium: "cpc" };
  if (params.get("fbclid")) return { source: "facebook", medium: "paid_social" };
  return null;
}

/**
 * Picks the tracking number for a first-touch source. Lookup order:
 * "source/medium", then "source", then "*" + "/medium", then the fallback (the main firm number).
 */
export function pickTrackingNumber(touch: FirstTouch | null | undefined, numbers: Record<string, string>, fallback: string): string {
  if (!touch) return fallback;
  const source = touch.source?.toLowerCase();
  const medium = touch.medium?.toLowerCase();
  const keys: string[] = [];
  if (source && medium) keys.push(`${source}/${medium}`);
  if (source) keys.push(source);
  if (medium) keys.push(`*/${medium}`);
  for (const k of keys) {
    const n = numbers[k];
    if (n && n.replace(/\D/g, "").length >= 10) return n;
  }
  return fallback;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}
