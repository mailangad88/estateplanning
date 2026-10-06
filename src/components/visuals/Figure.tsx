import type { ReactNode } from "react";
import { useId } from "react";

export type FigureProps = {
  /** Short accessible name, read by screen readers as the image title. */
  title: string;
  /** Full text alternative: what the picture shows and what it means. */
  desc: string;
  /** SVG viewBox width and height. The SVG scales to the container width. */
  width: number;
  height: number;
  /** Optional visible caption under the figure. */
  caption?: ReactNode;
  /** Render the bare <svg> without the <figure> wrapper (for video frames and OG). */
  bare?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Accessible, responsive wrapper for every illustration and diagram.
 * The SVG gets role="img" with <title> and <desc>, so the diagram's meaning
 * is available as text to screen readers and crawlers.
 */
export function Figure({ title, desc, width, height, caption, bare, className, children }: FigureProps) {
  const id = useId().replace(/:/g, "");
  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      {children}
    </svg>
  );
  if (bare) return svg;
  return (
    <figure className={["v-figure", className].filter(Boolean).join(" ")}>
      {svg}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
