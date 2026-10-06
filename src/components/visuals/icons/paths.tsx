import type { ReactNode } from "react";

/**
 * Icon drawings on a 24x24 grid, 2px round strokes. Each entry draws with
 * `currentColor` for strokes; `tint` marks the soft two-tone fill layer.
 * Add new icons here; names match the `iconHints` in the video scripts.
 */
export const iconPaths: Record<string, (tint: string) => ReactNode> = {
  house: (t) => (
    <>
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill={t} />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  document: (t) => (
    <>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill={t} />
      <path d="M14 3v4h4M8 12h8M8 16h5" />
    </>
  ),
  will: (t) => (
    <>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill={t} />
      <path d="M14 3v4h4M8 11h8M8 14h5M8 18c1.2-1.4 2-1.4 2.6 0s1.4 1.2 2.4-.4" />
    </>
  ),
  trust: (t) => (
    <>
      <path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z" fill={t} />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  shield: (t) => <path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z" fill={t} />,
  "power-of-attorney": (t) => (
    <>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill={t} />
      <circle cx="11" cy="12" r="2.5" />
      <path d="M13 13.5 16.5 17M15 15.5l1-1" />
    </>
  ),
  "health-directive": (t) => (
    <>
      <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill={t} />
      <path d="M12 16.5s-4-2.4-4-5a2 2 0 0 1 4-.8 2 2 0 0 1 4 .8c0 2.6-4 5-4 5z" />
    </>
  ),
  heart: (t) => <path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.7 12 20 12 20z" fill={t} />,
  gavel: (t) => (
    <>
      <path d="m13 4 6 6-2.5 2.5-6-6z" fill={t} />
      <path d="m11.8 8.8-7 7a1.4 1.4 0 0 0 2 2l7-7M4 21h9" />
    </>
  ),
  courthouse: (t) => (
    <>
      <path d="M3 9 12 4l9 5z" fill={t} />
      <path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" />
    </>
  ),
  scale: (t) => (
    <>
      <path d="M12 4v16M8 20h8M5 7h14" />
      <path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" fill={t} />
    </>
  ),
  clock: (t) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={t} />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (t) => (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" fill={t} />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  check: () => <path d="m5 12.5 4.5 4.5L19 7.5" />,
  "check-circle": (t) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={t} />
      <path d="m8 12.5 2.8 2.8L16 10" />
    </>
  ),
  "arrow-right": () => <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-down": () => <path d="M12 5v14M6 13l6 6 6-6" />,
  "question-mark": (t) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={t} />
      <path d="M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 1.9M12 16.6v.1" />
    </>
  ),
  "family-tree": (t) => (
    <>
      <circle cx="12" cy="5" r="2.2" fill={t} />
      <circle cx="5.5" cy="18" r="2.2" fill={t} />
      <circle cx="12" cy="18" r="2.2" fill={t} />
      <circle cx="18.5" cy="18" r="2.2" fill={t} />
      <path d="M12 7.2V12M5.5 15.8V12h13v3.8M12 12v3.8" />
    </>
  ),
  family: (t) => (
    <>
      <circle cx="8" cy="6.5" r="2.3" fill={t} />
      <circle cx="16" cy="6.5" r="2.3" fill={t} />
      <circle cx="12" cy="13" r="1.8" fill={t} />
      <path d="M4 20v-5a4 4 0 0 1 6-3.4M20 20v-5a4 4 0 0 0-6-3.4M9.5 20v-1.5a2.5 2.5 0 0 1 5 0V20" />
    </>
  ),
  person: (t) => (
    <>
      <circle cx="12" cy="8" r="3.5" fill={t} />
      <path d="M5 20a7 7 0 0 1 14 0z" fill={t} />
    </>
  ),
  child: (t) => (
    <>
      <circle cx="12" cy="9" r="3" fill={t} />
      <path d="M7 20a5 5 0 0 1 10 0z" fill={t} />
    </>
  ),
  partner: (t) => (
    <>
      <circle cx="9" cy="8" r="2.8" fill={t} />
      <circle cx="16" cy="9" r="2.4" fill={t} />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0zM13.5 15.2A4.6 4.6 0 0 1 20.5 19" />
    </>
  ),
  friend: (t) => (
    <>
      <circle cx="12" cy="8" r="3.2" fill={t} />
      <path d="M6 20a6 6 0 0 1 12 0" />
      <path d="M18 4.5l.6 1.3 1.4.2-1 1 .2 1.4-1.2-.7-1.2.7.2-1.4-1-1 1.4-.2z" />
    </>
  ),
  charity: (t) => (
    <>
      <path d="M12 13s-4-2.3-4-5a2 2 0 0 1 4-.9A2 2 0 0 1 16 8c0 2.7-4 5-4 5z" fill={t} />
      <path d="M3 16h4l3 2h5a1.5 1.5 0 0 0 0-3h-3M7 20l-4-.1" />
    </>
  ),
  key: (t) => (
    <>
      <circle cx="8" cy="12" r="4" fill={t} />
      <path d="M12 12h9M17 12v3M20 12v2" />
    </>
  ),
  bank: (t) => (
    <>
      <path d="M3 9 12 4l9 5z" fill={t} />
      <path d="M5 10v7M10 10v7M14 10v7M19 10v7M3 20h18" />
    </>
  ),
  "piggy-bank": (t) => (
    <>
      <path d="M5 11a6 5 0 0 1 11-2.5h2l1 2.5 1.5.5v3l-2 .5-1 2.5h-2.5v-1.5h-4V18H7.5l-1-3A5 5 0 0 1 5 11z" fill={t} />
      <path d="M10 6.5h3M16 12h.01" />
    </>
  ),
  car: (t) => (
    <>
      <path d="M4 16v-3l2-5h12l2 5v3z" fill={t} />
      <path d="M4 13h16M7 19v-3M17 19v-3" />
    </>
  ),
  briefcase: (t) => (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" fill={t} />
      <path d="M9 7V5h6v2M3 12h18" />
    </>
  ),
  "life-insurance": (t) => (
    <>
      <path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z" fill={t} />
      <path d="M12 15.5s-3-1.8-3-3.8a1.5 1.5 0 0 1 3-.6 1.5 1.5 0 0 1 3 .6c0 2-3 3.8-3 3.8z" />
    </>
  ),
  retirement: (t) => (
    <>
      <path d="M4 20V10M10 20V6M16 20v-8M20 20H3" />
      <path d="M4 10l6-4 6 6 4-3" fill="none" />
      <circle cx="20" cy="9" r="1.6" fill={t} />
    </>
  ),
  ladder: (t) => (
    <>
      <path d="M7 3v18M17 3v18" />
      <path d="M7 6h10M7 10.5h10M7 15h10M7 19.5h10" stroke={t === "none" ? undefined : t} />
    </>
  ),
  signature: () => <path d="M3 18c3-6 5-10 6.5-10S9 15 11 15s2.5-4 4-4 1 4 2.5 4H21M3 21h18" />,
  pen: (t) => (
    <>
      <path d="M15 4l5 5L9 20H4v-5z" fill={t} />
      <path d="M13 6l5 5" />
    </>
  ),
  envelope: (t) => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" fill={t} />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </>
  ),
  phone: (t) => <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" fill={t} />,
  "chat": (t) => <path d="M4 5h16v11H9l-5 4z" fill={t} />,
  lock: (t) => (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" fill={t} />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </>
  ),
  "folder": (t) => <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill={t} />,
  "magnifier": (t) => (
    <>
      <circle cx="10.5" cy="10.5" r="6" fill={t} />
      <path d="m15 15 5 5" />
    </>
  ),
  "dollar": (t) => (
    <>
      <circle cx="12" cy="12" r="8.5" fill={t} />
      <path d="M14.5 9.2c-.5-.9-1.5-1.4-2.5-1.4-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.9 2.5 2.1-1.1 2-2.5 2c-1.1 0-2.1-.5-2.6-1.4M12 6.5v11" />
    </>
  ),
  "hourglass": (t) => (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3v3a4 4 0 0 0 4 4 4 4 0 0 0 4-4V3zM8 21v-3a4 4 0 0 1 4-4 4 4 0 0 1 4 4v3z" fill={t} />
    </>
  ),
  "hand-heart": (t) => (
    <>
      <path d="M12 11s-3.5-2-3.5-4.4a1.75 1.75 0 0 1 3.5-.7 1.75 1.75 0 0 1 3.5.7C15.5 9 12 11 12 11z" fill={t} />
      <path d="M3 15h4l3 2h5a1.5 1.5 0 0 0 0-3h-3M7 20H3" />
    </>
  ),
  "button": (t) => (
    <>
      <rect x="3" y="7" width="18" height="10" rx="5" fill={t} />
      <path d="M10 12h5M13 10l2 2-2 2" />
    </>
  ),
  "list": () => <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  "puzzle": (t) => (
    <path
      d="M5 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H5v-4a2 2 0 1 0 0-4z"
      fill={t}
    />
  ),
  "sprout": (t) => (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" fill={t} />
    </>
  ),
  "map-pin": (t) => (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill={t} />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
};

export type IconName = keyof typeof iconPaths;
