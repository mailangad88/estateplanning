"use client";

import { useEffect, useRef } from "react";
import type { VideoEntry } from "./types";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Native video with captions on by default, chapter buttons, and ?t=SECONDS deep links. */
export function VideoPlayer({ video, vertical }: { video: VideoEntry; vertical?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("t"));
    if (t > 0 && ref.current) ref.current.currentTime = t;
  }, []);

  const seek = (s: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = s;
    void el.play().catch(() => {});
  };

  const src = vertical && video.verticalSrc ? video.verticalSrc : video.src;
  return (
    <>
      <video
        ref={ref}
        controls
        playsInline
        preload="none"
        poster={video.poster}
        aria-label={video.title}
        style={vertical ? { maxWidth: 420, margin: "0 auto" } : undefined}
      >
        <source src={src} type="video/mp4" />
        <track kind="captions" src={video.captions} srcLang="en" label="English" default />
      </video>
      {video.chapters.length > 1 ? (
        <details>
          <summary>Chapters</summary>
          <ol className="v-chapters">
            {video.chapters.map((ch) => (
              <li key={ch.startSec}>
                <button type="button" onClick={() => seek(ch.startSec)}>
                  {fmt(ch.startSec)}
                </button>{" "}
                {ch.title}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </>
  );
}
