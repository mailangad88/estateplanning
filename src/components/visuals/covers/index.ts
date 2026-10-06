// Lead magnet cover barrel.
export { ResourceCover, wrapText, type ResourceCoverProps, type CoverPalette } from "./ResourceCover";
export { MagnetCover } from "./MagnetCover";
export { magnets, getMagnet, type MagnetConfig } from "./magnets";
export { MagnetCoverFromMeta } from "./MagnetCover";
export { coverPropsFromMagnet, shorten, type MagnetMeta } from "./fromMeta";
export type { CoverFormat } from "./motifs";

/** Public path of the exported cover image (1200x1600 PNG; WebP and -600 variants sit beside it). */
export const coverImagePath = (slug: string) => `/media/covers/${slug}.png`;
/** Public path of the 1200x630 share image. */
export const coverOgPath = (slug: string) => `/media/covers/${slug}-og.png`;
