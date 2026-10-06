import type { ReactNode } from "react";
import { ResourceCover } from "./ResourceCover";
import { coverPropsFromMagnet, type MagnetMeta } from "./fromMeta";
import { getMagnet } from "./magnets";

/** The cover for one lead magnet, by slug. Renders nothing for an unknown slug. */
export function MagnetCover({ slug, bare, caption }: { slug: string; bare?: boolean; caption?: ReactNode }) {
  const m = getMagnet(slug);
  if (!m) return null;
  return <ResourceCover {...m} bare={bare} caption={caption} />;
}

/** A cover built straight from a magnet's frontmatter (title, promise, format, category, sequence). */
export function MagnetCoverFromMeta({ meta, bare, caption }: { meta: MagnetMeta; bare?: boolean; caption?: ReactNode }) {
  return <ResourceCover {...coverPropsFromMagnet(meta)} bare={bare} caption={caption} />;
}
