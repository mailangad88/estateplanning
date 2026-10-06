import { firm } from "@/config/firm";
import { ogContentType, ogSize, pageOgImage } from "@/lib/page-og";

export const alt = `${firm.brandName} share image`;
export const size = ogSize;
export const contentType = ogContentType;
export { generateStaticParams } from "./page";

export default async function Image({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  return pageOgImage(`/course/${day}`);
}
