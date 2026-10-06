import type { ReactNode } from "react";

/** Props every diagram accepts. */
export type DiagramProps = {
  /** Visible caption under the figure. */
  caption?: ReactNode;
  /** Render only the <svg>, for video frames, OG images and exports. */
  bare?: boolean;
  /**
   * Progressive reveal for video. When a number, elements that belong to a
   * later step render hidden (or dimmed); undefined shows everything.
   */
  step?: number;
};
