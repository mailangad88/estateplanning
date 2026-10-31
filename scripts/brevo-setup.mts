/**
 * Prepares a Brevo account for our sequences. Dry run by default: prints what it would create.
 *
 *   npm run brevo:setup                          # plan only, no API key needed
 *   BREVO_API_KEY=... npm run brevo:setup -- --apply
 *   BREVO_API_KEY=... BREVO_SENDER_EMAIL=... npm run brevo:setup -- --apply --templates
 *
 * --apply creates (if missing) the folder, one `ep-seq-<id>` list per email sequence, and the EP_* text
 * attributes. --templates also uploads every email template as an INACTIVE draft named
 * "DRAFT not approved - <key>". Nothing here sends email: automations are built and switched on in
 * Brevo by a person, after the attorney approves the copy. Safe to re-run.
 */
import { BrevoAdapter, BREVO_FOLDER_NAME } from "../src/server/crm/brevo";
import { brevoCustomAttributes, brevoSequenceLists, brevoTemplatePayload } from "../src/server/crm/brevoSetup";
import { TEMPLATE_COPY } from "../src/server/nurture/templateCopy";
import { firm } from "../src/config/firm";

const apply = process.argv.includes("--apply");
const templates = process.argv.includes("--templates");
const lists = brevoSequenceLists();
const attrs = brevoCustomAttributes();
const emails = TEMPLATE_COPY.filter((t) => t.channel === "email");

console.log(`Folder: ${BREVO_FOLDER_NAME}`);
console.log(`Lists (${lists.length}):\n${lists.map((l) => `  ${l.listName}  (${l.emailSteps} email steps)`).join("\n")}`);
console.log(`Text attributes (${attrs.length}): ${attrs.join(", ")}`);
if (templates) console.log(`Templates: ${emails.length} inactive drafts`);
if (!apply) {
  console.log("\nDry run. Add --apply with BREVO_API_KEY set to create these.");
  process.exit(0);
}

const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) throw new Error("BREVO_API_KEY is not set");
const brevo = new BrevoAdapter({ apiKey });

const folders = (await brevo.call("GET", "/contacts/folders?limit=50&offset=0"))?.folders ?? [];
let folderId: number = folders.find((f: { name: string }) => f.name === BREVO_FOLDER_NAME)?.id;
if (!folderId) folderId = (await brevo.call("POST", "/contacts/folders", { name: BREVO_FOLDER_NAME })).id;

const existing = await brevo.sequenceLists();
for (const l of lists) {
  if (existing.has(l.sequenceId)) continue;
  await brevo.call("POST", "/contacts/lists", { name: l.listName, folderId });
  console.log(`created list ${l.listName}`);
}

const have = new Set(((await brevo.call("GET", "/contacts/attributes"))?.attributes ?? []).map((a: { name: string }) => a.name));
for (const name of attrs) {
  if (have.has(name)) continue;
  await brevo.call("POST", `/contacts/attributes/normal/${name}`, { type: "text" });
  console.log(`created attribute ${name}`);
}

if (templates) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL is not set (a sender verified in Brevo)");
  const bookingUrl = process.env.BREVO_BOOKING_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/book`;
  const vars = { firmName: firm.brandName, attorneyName: firm.attorneyName, bookingUrl };
  const current = new Set(((await brevo.call("GET", "/smtp/templates?limit=1000&offset=0"))?.templates ?? []).map((t: { name: string }) => t.name));
  for (const copy of emails) {
    const payload = brevoTemplatePayload(copy, vars, { email: senderEmail, name: firm.brandName });
    if (current.has(payload.templateName)) continue;
    await brevo.call("POST", "/smtp/templates", payload);
    console.log(`uploaded ${payload.templateName}`);
  }
}
console.log("Done.");
