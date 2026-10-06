import type { ReactNode } from "react";

/** Props every diagram accepts. */
export type DiagramProps = {
  /** Visible caption under the figure. */
  caption?: ReactNode;
  /** Render only the <svg>, for video frames, OG images and exports. */
  bare?: boolean;
};
