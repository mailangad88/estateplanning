"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LeadForm, { type LeadResponse } from "@/components/LeadForm";

export default function GuideGate({ slug }: { slug: string }) {
  const [viaExit, setViaExit] = useState(false);
  const [done, setDone] = useState<LeadResponse | null>(null);

  useEffect(() => {
    setViaExit(new URLSearchParams(window.location.search).get("via") === "exit");
  }, []);

  if (done) {
    return (
      <div className="result" aria-live="polite">
        <strong>Your guide is ready.</strong>
        <p>
          <Link className="button" href={done.guideUrl ?? `/guides/${slug}`}>Open the guide</Link>
        </p>
        <p className="notice">We will also email you a link so you can find it later.</p>
      </div>
    );
  }

  return (
    <LeadForm
      tool={viaExit ? "exit_offer" : "guide"}
      resource={slug}
      legend="Where should we send it?"
      why="You can open the guide right away. We will also email a copy, and you can choose to get a text with the link."
      submitLabel="Get the free guide"
      onSuccess={setDone}
    />
  );
}
