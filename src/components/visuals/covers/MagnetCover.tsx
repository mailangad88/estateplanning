import type { ReactNode } from "react";
import { ResourceCover } from "./ResourceCover";
import { getMagnet } from "./magnets";

/** The cover for one lead magnet, by slug. Renders nothing for an unknown slug. */
export function MagnetCover({ slug, bare, caption }: { slug: string; bare?: boolean; caption?: ReactNode }) {
  const m = getMagnet(slug);
  if (!m) return null;
  return <ResourceCover {...m} bare={bare} caption={caption} />;
}
