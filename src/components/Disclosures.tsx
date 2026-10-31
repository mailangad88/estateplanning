import Link from "next/link";
import { firm, servedStates, SITE_DISCLAIMER } from "@/config/firm";
import { COMPLIANCE_VERSION, rulesFor, stateName } from "@/config/compliance";

/** No-promise-of-results note (B4). Use next to fees, testimonials and anything describing outcomes. */
export const RESULTS_NOTE =
  "Every family and every matter is different. No attorney can promise a particular result, and past experience does not guarantee a similar result.";

export function ResultsNote({ className = "notice" }: { className?: string }) {
  return <p className={className}>{RESULTS_NOTE}</p>;
}

function listStates(codes: string[]): string {
  const names = codes.map(stateName);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * State-aware advertising disclosures (B21). Server component. Renders the labels and notices
 * required for every state the firm serves (servedStates()), merged strictest-wins, with a
 * conservative default for any state that has no entry in config/compliance.ts.
 * Plain visible text only: never hide required text behind a click or in tiny type.
 */
export function Disclosures({ states = servedStates(), variant = "footer" }: { states?: string[]; variant?: "footer" | "page" }) {
  const rules = rulesFor(states);
  // The full office street address names the city and state, which also meets needsOfficeLocality.
  const office = firm.officeAddress;
  return (
    <div className="disclosures" data-compliance-version={COMPLIANCE_VERSION} data-states={rules.states.join(",")}>
      <p>
        <strong>{rules.webLabels.join(". ")}.</strong> {firm.firmLegalName}, {office}, {firm.phone},{" "}
        <a href={`mailto:${firm.email}`}>{firm.email}</a>. Responsible attorney: {firm.attorneyName}. Our attorney network serves {listStates(rules.states)} only.
      </p>
      <p>
        <strong>{SITE_DISCLAIMER}</strong> Laws differ by state. An attorney-client relationship begins only when you and an attorney
        sign an engagement agreement. Please do not send confidential details through the site&apos;s forms. {RESULTS_NOTE}
      </p>
      {rules.disclaimers.map((d) => (
        <p key={d}>{d}</p>
      ))}
      {variant === "footer" && (
        <p>
          <Link href="/legal/attorney-advertising">Attorney advertising notice</Link>
        </p>
      )}
    </div>
  );
}
