import { firm } from "@/config/firm";
import { ogContentType, ogSize, pageOgImage } from "@/lib/page-og";

export const alt = `${firm.brandName} share card with the page title (glossary)`;
export const size = ogSize;
export const contentType = ogContentType;
export { generateStaticParams } from "./page";

export default async function Image({ params }: { params: Promise<{ term: string }> }) {
  const p = await params;
  return pageOgImage(`/glossary/${p.term}`);
}
