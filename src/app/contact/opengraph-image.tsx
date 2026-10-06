import { firm } from "@/config/firm";
import { ogContentType, ogSize, pageOgImage } from "@/lib/page-og";

export const alt = `${firm.brandName} share image`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return pageOgImage("/contact");
}
