"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TOOL_STATE } from "@/config/tools";

/**
 * Renders a tool with its state question prefilled from `?state=XX`, so state pages and
 * ads can link straight to a tool for one state. Without the parameter the launch state
 * (DEFAULT_TOOL_STATE) is preselected; visitors can still pick any other state. The page
 * stays static because the parameter is read in the browser.
 */
export default function StatePrefill({ tool: Tool }: { tool: React.ComponentType<{ initialState?: string }> }) {
  const [code, setCode] = useState<string>(DEFAULT_TOOL_STATE);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("state")?.trim().toUpperCase();
    if (raw && /^[A-Z]{2}$/.test(raw)) setCode(raw);
  }, []);
  return <Tool key={code} initialState={code} />;
}
