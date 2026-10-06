"use client";

import { useEffect } from "react";
import { sessionSource } from "@/lib/visitor";

/** Records the landing page and campaign parameters on the first page of a visit. */
export default function SourceTracker() {
  useEffect(() => {
    sessionSource();
  }, []);
  return null;
}
