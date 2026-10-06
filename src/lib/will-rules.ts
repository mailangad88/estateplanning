import { getStateGuides } from "@/lib/library";

/**
 * The 50-state (plus DC) will rules table: how a will must be signed, whether a handwritten will counts and
 * whether a self-proving affidavit is available. Built from the facts in each state guide (content/states),
 * so the table and the guides can never disagree. The short yes/no columns are derived from the guide text;
 * the full text is always shown next to them, and both wait for attorney review like every state page.
 */

export type YesNo = "Yes" | "No" | "Limited" | "Confirm";

export interface WillRuleRow {
  state: string;
  abbr: string;
  url: string;
  witnesses: string;
  handwritten: YesNo;
  selfProving: YesNo;
  signingRule: string;
  handwrittenRule: string;
  selfProvingRule: string;
  review: "pending" | "approved";
  updated: string;
}

const NUMBER = /\b(two|three|one)\b/i;

function handwritten(text: string): YesNo {
  if (/^confirm/i.test(text)) return "Confirm";
  if (/^(yes|recognized|effectively yes)/i.test(text)) return "Yes";
  if (/^(generally no|handwritten, unwitnessed wills are not)/i.test(text)) return /only|except/i.test(text) ? "Limited" : "No";
  if (/^not recognized unless (it|the will) (was |is )?(validly )?(made|written|executed|signed) (in|under the law of) /i.test(text)) return "Limited";
  if (/^(no|not recognized)/i.test(text)) return "No";
  return "Limited";
}

function selfProving(text: string): YesNo {
  if (/^yes/i.test(text)) return "Yes";
  if (/^confirm/i.test(text)) return "Confirm";
  if (/^(no\b|no formal|no classic)|has no (formal )?self-proving/i.test(text)) return "No";
  return "Limited";
}

export function willRulesTable(): WillRuleRow[] {
  return getStateGuides()
    .map((g) => {
      const f = g.facts;
      const n = NUMBER.exec(f.willSigning ?? "")?.[1]?.toLowerCase();
      // Pennsylvania-style rules: no witnesses at signing unless the testator signs by mark or by proxy.
      const noneAtSigning = /witnesses are required at signing only if/i.test(f.willSigning ?? "");
      return {
        state: g.name,
        abbr: g.abbr,
        url: g.url,
        witnesses: noneAtSigning ? "None at signing (see rule)" : n ? { one: "1", two: "2", three: "3" }[n]! : "See rule",
        handwritten: handwritten(f.holographicWills ?? ""),
        selfProving: selfProving(f.selfProving ?? ""),
        signingRule: f.willSigning ?? "",
        handwrittenRule: f.holographicWills ?? "",
        selfProvingRule: f.selfProving ?? "",
        review: g.review,
        updated: g.updated,
      };
    })
    .sort((a, b) => a.state.localeCompare(b.state));
}

export function willRulesCsv(): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = ["state", "abbr", "witnesses", "handwritten_will_valid", "self_proving_affidavit", "signing_rule", "handwritten_rule", "self_proving_rule", "source_page", "updated", "attorney_reviewed"];
  const rows = willRulesTable().map((r) =>
    [r.state, r.abbr, r.witnesses, r.handwritten, r.selfProving, r.signingRule, r.handwrittenRule, r.selfProvingRule, r.url, r.updated, r.review === "approved" ? "yes" : "no"].map(esc).join(","),
  );
  return [head.join(","), ...rows].join("\n") + "\n";
}
