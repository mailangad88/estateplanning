import { iconPaths } from "./paths";
import { c, type ColorName } from "../tokens";

export type IconProps = {
  name: string;
  size?: number;
  /** Stroke colour. */
  color?: ColorName;
  /** Two-tone fill colour, or "none" for line-only. */
  tint?: ColorName | "none";
  /** Accessible label. Omit for decorative icons (they are hidden from screen readers). */
  label?: string;
  /** Position when nesting inside another SVG. When set, renders a <g> instead of an <svg>. */
  x?: number;
  y?: number;
  strokeWidth?: number;
};

/**
 * One icon from the house set. Standalone it renders an inline <svg>; with
 * x/y it renders a positioned group for use inside diagrams and video frames.
 */
export function Icon({ name, size = 24, color = "accent", tint = "accentTint", label, x, y, strokeWidth = 2 }: IconProps) {
  const draw = iconPaths[name] ?? iconPaths["question-mark"];
  const fill = tint === "none" ? "none" : c[tint];
  const body = (
    <g
      style={{ stroke: c[color], color: c[color] }}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {draw(fill)}
    </g>
  );
  if (x !== undefined || y !== undefined) {
    const s = size / 24;
    return <g transform={`translate(${x ?? 0} ${y ?? 0}) scale(${s})`}>{body}</g>;
  }
  return (
    <svg
      className="v-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {body}
    </svg>
  );
}

export const iconNames = Object.keys(iconPaths);
