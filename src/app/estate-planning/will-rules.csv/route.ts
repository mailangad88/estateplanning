import { willRulesCsv } from "@/lib/will-rules";

export const dynamic = "force-static";

/** The will rules table as a CSV download, for journalists, researchers and anyone who wants to cite it. */
export function GET() {
  return new Response(willRulesCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="will-rules-by-state.csv"',
    },
  });
}
