/** Build the URL of the dynamic share image for a page's metadata.openGraph.images. */
export function ogImageUrl(title: string, kicker?: string, variant?: "accent" | "sage" | "clay" | "gold"): string {
  const params = new URLSearchParams({ title });
  if (kicker) params.set("kicker", kicker);
  if (variant) params.set("variant", variant);
  return `/og?${params.toString()}`;
}
