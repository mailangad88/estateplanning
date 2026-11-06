/**
 * Checks a fragment of template copy (entries in the email(...) form used in
 * src/server/nurture/templateCopy.ts) against the same rules tests/templates.test.ts applies:
 * banned phrases, sensitive words in subjects, allowed placeholders, no stray brackets, and
 * that each key exists as an email step. Usage: npx tsx scripts/check-copy-fragment.mts <file>
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const file = process.argv[2];
if (!file) throw new Error("usage: check-copy-fragment.mts <fragment file>");
const frag = fs.readFileSync(file, "utf8");
const tmp = path.resolve("src/server/nurture/.fragment-check.ts");
fs.writeFileSync(tmp, `import { firm } from "@/config/firm";
import { EDUCATIONAL_DISCLAIMER } from "@/server/nurture/compliance";
import type { TemplateCopy } from "@/server/nurture/templateCopy";
const MARKETING_FOOTER = ["{{firmName}}, " + firm.officeAddress, "Unsubscribe: {{unsubscribeUrl}}", EDUCATIONAL_DISCLAIMER].join("\\n");
const SIGN = "{{attorneyName}}\\n{{firmName}}";
const NET_SIGN = "The {{firmName}} team";
const DRAFT = "draft";
function email(key: string, subject: string, body: string, source: string, _k?: string): TemplateCopy {
  return { key, channel: "email", subject, body: body.trim() + "\\n\\n--\\n" + MARKETING_FOOTER, source };
}
export const FRAGMENT: TemplateCopy[] = [
${frag}
];
`);
try {
  const { FRAGMENT } = await import(pathToFileURL(tmp).href);
  const { lintCopy, sensitiveContentIssues } = await import("../src/server/nurture/compliance");
  const { PLACEHOLDERS } = await import("../src/server/nurture/templateCopy");
  const { SEQUENCES } = await import("../src/server/nurture/sequences");
  const { firm } = await import("../src/config/firm");
  const steps = new Map(SEQUENCES.flatMap((s: any) => s.steps).map((st: any) => [st.templateKey, st]));
  let bad = 0;
  for (const t of FRAGMENT) {
    const issues: string[] = [];
    const st: any = steps.get(t.key);
    if (!st) issues.push("no step with this key");
    else if (st.channel !== "email") issues.push(`step channel is ${st.channel}`);
    for (const text of [t.subject ?? "", t.body]) {
      for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) if (!(PLACEHOLDERS as readonly string[]).includes(m[1])) issues.push(`placeholder {{${m[1]}}} not allowed`);
      if (/[{}[\]]/.test(text.replaceAll(firm.officeAddress, "").replace(/\{\{\s*\w+\s*\}\}/g, ""))) issues.push("stray bracket or brace");
    }
    for (const i of lintCopy(t.body, { requireDisclaimer: true }).issues) issues.push(`body: ${i.kind} "${i.phrase}"`);
    for (const i of lintCopy(t.subject ?? "", { requireDisclaimer: false }).issues) issues.push(`subject: ${i.kind} "${i.phrase}"`);
    for (const i of sensitiveContentIssues(t.subject ?? "", "email", "subject")) issues.push(`subject sensitive (${i.category}): "${i.phrase}"`);
    if (!t.subject) issues.push("missing subject");
    if (issues.length) { bad++; console.log(`${t.key}:\n  ${issues.join("\n  ")}`); }
  }
  console.log(`${FRAGMENT.length} entries checked, ${bad} with issues`);
  process.exitCode = bad ? 1 : 0;
} finally {
  fs.rmSync(tmp, { force: true });
}
