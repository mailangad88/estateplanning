"use client";

import { useEffect, useState } from "react";

/**
 * Renders a tool with its state question prefilled from `?state=XX`, so state pages and
 * ads can link straight to a tool for one state. The page stays static: the parameter is
 * read in the browser, and a bad or missing code just leaves the question blank.
 */
export default function StatePrefill({ tool: Tool }: { tool: React.ComponentType<{ initialState?: string }> }) {
  const [code, setCode] = useState<string | undefined>(undefined);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("state")?.trim().toUpperCase();
    if (raw && /^[A-Z]{2}$/.test(raw)) setCode(raw);
  }, []);
  return <Tool key={code ?? "none"} initialState={code} />;
}
