"use client";

/**
 * Browser-side visitor memory for progressive profiling. After someone submits a form,
 * their contact details are kept on this device so later forms only ask for what is missing.
 * Nothing is stored before a submission, and "forgetVisitor" clears it all.
 */

import type { CaptureTool } from "@/lib/lead";

const KEY = "fpl.visitor.v1";
const SOURCE_KEY = "fpl.source.v1";

export interface KnownContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  state?: string;
}

interface VisitorState {
  id: string;
  contact: KnownContact;
  tools: CaptureTool[];
}

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown) {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: forms still work, they just will not prefill.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function loadVisitor(): VisitorState | null {
  return read<VisitorState>(local, KEY);
}

/** Random id sent with every submission so the CRM can merge repeat visits. Not stored until a submission. */
export function visitorIdForSubmission(): string {
  return loadVisitor()?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
}

export function rememberSubmission(id: string, contact: KnownContact, tool: CaptureTool) {
  const prev = loadVisitor();
  const tools = [...(prev?.tools ?? []).filter((t) => t !== tool), tool].slice(-20);
  const merged: KnownContact = { ...prev?.contact };
  for (const [k, v] of Object.entries(contact) as [keyof KnownContact, string | undefined][]) if (v) merged[k] = v;
  write(local, KEY, { id, contact: merged, tools } satisfies VisitorState);
}

export function forgetVisitor() {
  try {
    local().removeItem(KEY);
  } catch {
    // ignore
  }
}

const SOURCE_PARAMS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
  ["gclid", "gclid"],
  ["gbraid", "gbraid"],
  ["wbraid", "wbraid"],
  ["fbclid", "fbclid"],
] as const;

function cookie(name: string): string | undefined {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) || undefined : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Meta's browser ids. _fbp and _fbc are first-party cookies set by the Meta pixel when one is installed.
 * Without the pixel, _fbc is rebuilt from fbclid in Meta's documented format (fb.1.<ms>.<fbclid>).
 */
export function metaBrowserIds(fbclid: string | undefined, now = Date.now()): { fbc?: string; fbp?: string } {
  const fbp = cookie("_fbp");
  const fbc = cookie("_fbc") ?? (fbclid ? `fb.1.${now}.${fbclid}` : undefined);
  return { ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) };
}

/**
 * Attribution for this browsing session. The first page with campaign parameters wins,
 * so a visitor who lands from an ad and then browses to a tool still credits the ad.
 */
export function sessionSource(): Record<string, string> {
  const saved = read<Record<string, string>>(session, SOURCE_KEY);
  const params = new URLSearchParams(window.location.search);
  const hasCampaign = SOURCE_PARAMS.some(([p]) => params.get(p));
  if (saved && !hasCampaign) return { ...metaBrowserIds(undefined), ...saved }; // the pixel may have set its cookies after the first page
  const s: Record<string, string> = { landingPage: window.location.href };
  if (document.referrer) s.referrer = document.referrer;
  for (const [param, key] of SOURCE_PARAMS) {
    const v = params.get(param);
    if (v) s[key] = v;
  }
  Object.assign(s, metaBrowserIds(s.fbclid));
  write(session, SOURCE_KEY, s);
  return s;
}
