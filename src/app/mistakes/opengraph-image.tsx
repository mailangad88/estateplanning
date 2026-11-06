import { firm } from "@/config/firm";
import { ogContentType, ogSize, pageOgImage } from "@/lib/page-og";

export const alt = `${firm.brandName} share card with the page title (mistakes)`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return pageOgImage("/mistakes");
}
