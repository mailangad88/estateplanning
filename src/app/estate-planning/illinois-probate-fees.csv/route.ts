import { ILLINOIS_PROBATE_FEES } from "@/config/illinois-probate-fees";

export const dynamic = "force-static";

const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** The Illinois county probate fee table as a CSV download. */
export function GET() {
  const head = ["County", "Estate filing fee (USD)", "Appearance fee (USD)", "Will filing fee (USD)", "Schedule effective", "Source", "Note"];
  const rows = ILLINOIS_PROBATE_FEES.map((r) => [r.county, r.estate, r.appearance, r.will, r.effective, r.source, r.note].map(cell).join(","));
  return new Response(`${[head.map(cell).join(","), ...rows].join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="illinois-probate-fees-by-county.csv"',
    },
  });
}
