"use client";

import dynamic from "next/dynamic";
import type { VideoPlan } from "@/server/studio/types";

// Client only: the templates measure text with a canvas, which the server cannot match.
const StudioPlayer = dynamic(() => import("@/studio/video/StudioPlayer"), { ssr: false, loading: () => <p className="notice">Loading preview…</p> });

export default function StudioPreview({ plan }: { plan: VideoPlan }) {
  return <StudioPlayer plan={plan} />;
}
