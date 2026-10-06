import { renderOgImage, type OgVariant } from "@/lib/og";

const variants: OgVariant[] = ["accent", "sage", "clay", "gold"];

function clean(v: string | null, max: number): string | undefined {
  const s = (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return s || undefined;
}

/** Dynamic share image: /og?title=...&kicker=...&variant=accent|sage|clay|gold */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = clean(searchParams.get("title"), 90) ?? "Estate planning with a real attorney";
  const kicker = clean(searchParams.get("kicker"), 32);
  const v = searchParams.get("variant") as OgVariant | null;
  const res = renderOgImage({ title, kicker, variant: v && variants.includes(v) ? v : "accent" });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
  return res;
}
