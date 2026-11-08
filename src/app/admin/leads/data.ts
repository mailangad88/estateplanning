import { can } from "@/server/auth/policy";
import { currentSession } from "@/server/runtime";
import { deskLeads, type DeskLead } from "@/server/services/leadDesk";
import type { Db } from "@/server/db";
import type { Actor } from "@/server/types";

export type DeskContext = { ok: true; actor: Actor; db: Db; rows: DeskLead[]; now: Date } | { ok: false; reason: "signed_out" | "forbidden" };

/** The signed-in user, their scoped store and every lead they may see on the desk. */
export async function loadDesk(): Promise<DeskContext> {
  const session = await currentSession();
  if (!session) return { ok: false, reason: "signed_out" };
  if (!can(session.actor, "view_lead_desk")) return { ok: false, reason: "forbidden" };
  const now = new Date();
  return { ok: true, actor: session.actor, db: session.db, rows: await deskLeads(session.db, session.actor, now), now };
}

export const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
export const dayOnly = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });
export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export function agoShort(iso: string, now: Date): string {
  const m = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export const phoneDisplay = (p: string) => (/^\d{10}$/.test(p) ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
