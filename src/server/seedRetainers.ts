/**
 * Development demo data for the retainer flow: the demo firm's own approved template (with a small standard-terms
 * PDF), and leads spread across the pipeline: consult held and ready for "Send retainer", a retainer out for
 * signature, one signed and paid, and one lost. Only the development runtime calls this, never tests. All names
 * are fictional; nothing is sent (the email transport is the quiet dry-run log).
 */
import type { Db } from "@/server/db";
import { MockPaymentProvider } from "@/server/esign/payments";
import { BuiltinEsignProvider, builtinSecret } from "@/server/esign/builtin";
import { LogEmailTransport } from "@/server/notify/transports";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS, demoRecord } from "@/server/seed";
import { approveEngagement, draftEngagement, sendEngagement } from "@/server/services/engagement";
import { exitLead, ingestLead, setStage, updateIntake } from "@/server/services/leads";
import { approveTemplate, saveTemplateVersion, setTemplateDefault, uploadAgreementPdf } from "@/server/services/retainerTemplates";
import { signEngagement } from "@/server/services/signing";
import type { Stage } from "@/server/types";

const DAY = 86_400_000;

/** A one-page PDF with a few lines of text, built by hand (no PDF library). */
export function simplePdf(title: string, lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = [`BT /F1 16 Tf 72 740 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 11 Tf 72 ${708 - i * 18} Td (${esc(l)}) Tj ET`)].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

export const DEMO_TEMPLATE_BODY = `FLAT-FEE ENGAGEMENT AGREEMENT
{{firm_name}}

Date: {{date}}
Client(s): {{client_names}}
Mailing address: {{client_address}}
Email: {{client_email}}   Phone: {{client_phone}}

1. WHAT WE WILL DO
You are hiring {{firm_name}} to help with: {{matter_type}}. Package: {{package}}.
Your responsible attorney is {{attorney_name}}.

2. WHAT YOU TOLD US
{{intake_summary}}
{{organizer_summary}}

3. OUR FEE
A flat fee of {{flat_fee}} for the work in section 1. The fee does not change if the work takes longer.
How you pay: {{payment_plan}}.

4. YOUR STANDARD TERMS
The firm's Standard Terms of Engagement (attached PDF) are part of this agreement.

5. GOVERNING LAW
The law of {{client_state}} governs this agreement.
`;

async function walk(db: Db, leadId: string, stages: Stage[], start: Date): Promise<void> {
  const intake = actorFor(DEMO_USERS[1]);
  for (const [i, s] of stages.entries()) await setStage(db, intake, leadId, s, new Date(start.getTime() + i * DAY));
}

export async function seedRetainerDemo(db: Db, now = new Date()): Promise<void> {
  const avery = actorFor(DEMO_USERS.find((u) => u.id === "u-lawyer-a")!);
  const office = actorFor(DEMO_USERS.find((u) => u.id === "u-firmadmin")!);
  const intake = actorFor(DEMO_USERS[1]);

  const pdf = await uploadAgreementPdf(db, avery, {
    name: "Standard Terms of Engagement.pdf",
    bytes: simplePdf("Standard Terms of Engagement (demo)", [
      "1. Communication. We answer messages within one business day.",
      "2. Your file. We keep your file for the period the rules require.",
      "3. Ending the engagement. Either of us may end it in writing.",
      "4. Unearned fees. Anything not yet earned is refunded.",
      "Demo document: replace with your firm's own standard terms.",
    ]),
  }, now);
  const t = await saveTemplateVersion(db, office, { name: "Estate plan flat-fee agreement", matterTypes: ["new_plan", "update_plan"], body: DEMO_TEMPLATE_BODY, pdf }, new Date(now.getTime() - 20 * DAY));
  const approved = await approveTemplate(db, avery, t.id, new Date(now.getTime() - 19 * DAY));
  await setTemplateDefault(db, office, approved.id, "new_plan", true, new Date(now.getTime() - 19 * DAY));

  const make = async (id: string, first: string, last: string, daysAgo: number, goals: string, spouse?: string) => {
    const at = new Date(now.getTime() - daysAgo * DAY);
    const lead = await ingestLead(db, demoRecord(id, first, last, { matterType: "new_plan", maritalStatus: spouse ? "married" : "single", children: "minors", ownsHome: "yes", assetRange: "250k_1m", urgency: "this_month" }, goals, at), at);
    await updateIntake(db, intake, lead.id, {
      summary: spouse ? `Married couple, two children, own a home.\nNo documents in place.\nWant guardians named and a trust.` : "Single parent, one child, owns a condo.\nOld will from 2012.\nWants a trust and guardian.",
      conflictParties: spouse ? [{ name: spouse, relationship: "spouse" }] : [],
      householdMembers: spouse ? [{ name: spouse, relationship: "spouse" }] : [],
    }, at);
    await db.leads.update(lead.id, { firmId: DEMO_FIRM_ID, assignedLawyerId: "lawyer-a" });
    return { lead, at };
  };

  // Consult held: ready for "Send retainer"
  const c = await make("lead-0003", "Casey", "Morgan", 9, "We want guardians for the kids and a trust.", "Riley Morgan");
  await walk(db, c.lead.id, ["qualified", "offered", "accepted", "consult_booked", "consult_held"], c.at);

  const esign = new BuiltinEsignProvider(builtinSecret());
  const pay = new MockPaymentProvider();
  const email = new LogEmailTransport(true);
  const terms = { tierId: "complete", tierPriceCents: 400000, plan: { mode: "plan" as const, depositCents: 100000, installments: 3 } };

  // Retainer sent, waiting for the client
  const s = await make("lead-0004", "Jordan", "Alvarez", 14, "Update my old will and add a trust for my daughter.");
  await walk(db, s.lead.id, ["qualified", "offered", "accepted", "consult_booked", "consult_held"], s.at);
  const d1 = await draftEngagement(db, avery, { leadId: s.lead.id, terms, mergeValues: { client_address: "48 Lakeview Ave, Springfield, IL 62704" } }, new Date(now.getTime() - 3 * DAY));
  await approveEngagement(db, avery, d1.id, new Date(now.getTime() - 3 * DAY));
  await sendEngagement(db, avery, d1.id, esign, pay, new Date(now.getTime() - 3 * DAY), { email });

  // Signed (and countersign pending)
  const g = await make("lead-0005", "Priya", "Shah", 20, "Set up a living trust before we travel.");
  await walk(db, g.lead.id, ["qualified", "offered", "accepted", "consult_booked", "consult_held"], g.at);
  const d2 = await draftEngagement(db, avery, { leadId: g.lead.id, terms: { tierId: "complete", tierPriceCents: 350000, plan: { mode: "full" } }, mergeValues: { client_address: "9 Oak Ct, Springfield, IL 62702" } }, new Date(now.getTime() - 6 * DAY));
  await approveEngagement(db, avery, d2.id, new Date(now.getTime() - 6 * DAY));
  const sent2 = await sendEngagement(db, avery, d2.id, esign, pay, new Date(now.getTime() - 6 * DAY), { email });
  const priya = (await db.users.list((u) => u.role === "client" && u.personId === g.lead.personId))[0];
  await signEngagement(db, actorFor(priya), {
    engagementId: d2.id, signerRole: "client", typedName: "Priya Shah", consent: true, intent: true, documentSha256: sent2.documentSha256!,
    device: { ipPrefix: "198.51.100.0/24", userAgent: "Safari on iPhone" },
  }, esign, { payments: pay }, new Date(now.getTime() - 5 * DAY));

  // Lost
  const l = await make("lead-0006", "Alex", "Kim", 12, "Just looking at options for now.");
  await walk(db, l.lead.id, ["qualified", "offered", "accepted", "consult_booked"], l.at);
  await exitLead(db, intake, l.lead.id, "chose_another_option", undefined, new Date(now.getTime() - 4 * DAY));
}
