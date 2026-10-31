/**
 * Merge fields for a firm's own retainer templates. Pure functions: no I/O, safe on the client for the
 * live preview. A template body is plain text with {{field}} placeholders picked from MERGE_FIELDS.
 *
 * `fillTemplate` returns the filled text plus a list of segments so the editor and the lead page can
 * highlight what is still missing. A letter is never sent with a missing field: the lawyer fills it in
 * on the lead page first.
 */

export const MERGE_FIELDS = [
  { key: "client_names", label: "Client name(s)", sample: "Taylor Rivera and Jamie Rivera" },
  { key: "client_address", label: "Client address", sample: "100 Main Street, Springfield, IL 62701" },
  { key: "client_email", label: "Client email", sample: "taylor@example.com" },
  { key: "client_phone", label: "Client phone", sample: "(217) 555-0100" },
  { key: "client_state", label: "Client state", sample: "Illinois" },
  { key: "matter_type", label: "Matter type", sample: "New estate plan" },
  { key: "package", label: "Package", sample: "Complete package (add-on: Pet trust)" },
  { key: "flat_fee", label: "Flat fee", sample: "$3,500" },
  { key: "payment_plan", label: "Payment plan", sample: "$1,500 deposit when you sign, then 4 monthly payments of $500" },
  { key: "intake_summary", label: "Intake answers summary", sample: "Married couple with two young children; own a home; no documents in place." },
  { key: "organizer_summary", label: "Organizer summary", sample: "Organizer: 4 of 6 sections done; 3 gaps flagged (no guardian named, no will, beneficiary not named on a 401(k))." },
  { key: "date", label: "Date", sample: "October 7, 2026" },
  { key: "attorney_name", label: "Attorney name", sample: "Avery Demo, Esq." },
  { key: "firm_name", label: "Firm name", sample: "Demo Law PLLC" },
] as const;

export type MergeFieldKey = (typeof MERGE_FIELDS)[number]["key"];
export type MergeValues = Partial<Record<MergeFieldKey, string>>;

const KEYS = new Set<string>(MERGE_FIELDS.map((f) => f.key));
export const isMergeField = (k: string): k is MergeFieldKey => KEYS.has(k);
export const fieldLabel = (k: MergeFieldKey) => MERGE_FIELDS.find((f) => f.key === k)!.label;

/** `{{ field }}`, spaces allowed inside the braces. */
const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

export type Segment = { text: string } | { field: MergeFieldKey; value?: string };

export interface FillResult {
  text: string;
  segments: Segment[];
  /** Fields the template uses that have no value, in first-use order */
  missing: MergeFieldKey[];
  /** Placeholders that are not merge fields (typos). A template with any cannot be approved. */
  unknown: string[];
  used: MergeFieldKey[];
}

/** Missing fields are written into the text as a visible marker, never left blank. */
export const missingMarker = (k: MergeFieldKey) => `[[${fieldLabel(k)}: missing]]`;

export function fillTemplate(body: string, values: MergeValues): FillResult {
  const segments: Segment[] = [];
  const missing: MergeFieldKey[] = [];
  const unknown: string[] = [];
  const used: MergeFieldKey[] = [];
  let last = 0;
  let text = "";
  for (const m of body.matchAll(PLACEHOLDER)) {
    const before = body.slice(last, m.index);
    if (before) segments.push({ text: before });
    text += before;
    const key = m[1];
    if (!isMergeField(key)) {
      if (!unknown.includes(key)) unknown.push(key);
      segments.push({ text: m[0] });
      text += m[0];
    } else {
      if (!used.includes(key)) used.push(key);
      const v = values[key]?.trim();
      if (v) {
        segments.push({ field: key, value: v });
        text += v;
      } else {
        if (!missing.includes(key)) missing.push(key);
        segments.push({ field: key });
        text += missingMarker(key);
      }
    }
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = body.slice(last);
  if (rest) segments.push({ text: rest });
  text += rest;
  return { text, segments, missing, unknown, used };
}

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "the District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
export const stateName = (code: string) => STATE_NAMES[code.toUpperCase()] ?? code;

export const SAMPLE_VALUES: MergeValues = Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample])) as MergeValues;

/** A starting point for a firm's own template. The firm replaces the wording; it is theirs to stand behind. */
export const STARTER_TEMPLATE = `ENGAGEMENT AGREEMENT
{{firm_name}}

Date: {{date}}
Client: {{client_names}}
Address: {{client_address}}
Email: {{client_email}} · Phone: {{client_phone}}

1. What you are hiring us to do
You are hiring {{firm_name}} for: {{matter_type}}, {{package}}. Your responsible attorney is {{attorney_name}}.

2. What we know so far
{{intake_summary}}

3. Our fee
A flat fee of {{flat_fee}}. Payment: {{payment_plan}}.

4. Governing law
This agreement is governed by the law of {{client_state}}.

[Replace this starter wording with your firm's approved engagement letter.]
`;
