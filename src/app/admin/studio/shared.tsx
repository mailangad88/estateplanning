import Link from "next/link";
import { publishMode } from "@/server/studio/config";
import type { Stage } from "@/server/studio/types";

export const STAGE_LABEL: Record<Stage, string> = {
  idea: "Idea",
  scripted: "Scripted",
  needs_rewrite: "Needs a rewrite",
  in_review: "Waiting for attorney",
  changes_requested: "Sent back",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  rejected: "Rejected",
};

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export function StudioNav() {
  const mode = publishMode();
  return (
    <>
      <p>
        <Link href="/portal">Leads and portal</Link> · <strong>Studio:</strong> <Link href="/admin/studio">Videos</Link> · <Link href="/admin/studio/schedule">Schedule</Link> · <Link href="/admin/studio/channels">Channels</Link>
      </p>
      {mode === "off" && <p className="notice" role="note">Publishing is off. Nothing posts to YouTube or Instagram; due videos are logged so you can see what would have gone out.</p>}
      {mode === "private" && <p className="notice" role="note">Publishing is private: YouTube uploads are private until you make them public in YouTube Studio. Instagram is skipped.</p>}
      {mode === "live" && <p className="error" role="note">Publishing is live. Approved videos post publicly at their scheduled time.</p>}
    </>
  );
}
