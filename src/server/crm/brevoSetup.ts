/**
 * What `npm run brevo:setup` creates in a Brevo account: a folder, one list per email sequence
 * (`ep-seq-<id>`), the EP_* contact attributes, and (optionally) our template copy as INACTIVE drafts.
 * Pure helpers here; the script does the HTTP calls. Creating lists and templates sends nothing:
 * a Brevo automation only sends after someone builds it, activates it, and contacts join its list.
 */
import { BREVO_ATTRIBUTES, BREVO_LIST_PREFIX } from "@/server/crm/brevo";
import { SEQUENCES } from "@/server/nurture/sequences";
import type { TemplateCopy } from "@/server/nurture/templateCopy";

/** Sequences with at least one email step: each gets a Brevo list (its automation's entry trigger). */
export function brevoSequenceLists(): { sequenceId: string; listName: string; emailSteps: number }[] {
  return SEQUENCES.map((s) => ({ sequenceId: s.id, listName: `${BREVO_LIST_PREFIX}${s.id}`, emailSteps: s.steps.filter((st) => st.channel === "email").length }))
    .filter((s) => s.emailSteps > 0);
}

/** Brevo creates FIRSTNAME and LASTNAME itself; the rest are ours. */
export function brevoCustomAttributes(): string[] {
  return BREVO_ATTRIBUTES.filter((a) => a !== "FIRSTNAME" && a !== "LASTNAME");
}

export interface BrevoTemplateVars {
  firmName: string;
  attorneyName: string;
  bookingUrl: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Our placeholders to Brevo's: first name from the contact, Brevo's own unsubscribe link (so the
 * unsubscribe reaches us through the webhook), firm values filled in. resourceUrl and portalUrl have no
 * Brevo equivalent: they stay as visible [[...]] markers the person building the automation must replace.
 */
export function toBrevoText(text: string, vars: BrevoTemplateVars): string {
  return text
    .replace(/\{\{\s*firstName\s*\}\}/g, "{{ contact.FIRSTNAME | default: 'there' }}")
    .replace(/\{\{\s*unsubscribeUrl\s*\}\}/g, "{{ unsubscribe }}")
    .replace(/\{\{\s*firmName\s*\}\}/g, vars.firmName)
    .replace(/\{\{\s*attorneyName\s*\}\}/g, vars.attorneyName)
    .replace(/\{\{\s*bookingUrl\s*\}\}/g, vars.bookingUrl)
    .replace(/\{\{\s*(?!unsubscribe\b)(\w+)\s*\}\}/g, "[[$1: replace before use]]");
}

/** Plain text to minimal HTML: paragraphs on blank lines, line breaks inside. */
export function toBrevoHtml(text: string): string {
  const paras = text.trim().split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1f2933">${paras.join("")}</body></html>`;
}

/** Body for POST /v3/smtp/templates. Always inactive and named as an unapproved draft. */
export function brevoTemplatePayload(copy: TemplateCopy, vars: BrevoTemplateVars, sender: { email: string; name: string }) {
  if (copy.channel !== "email") throw new Error(`${copy.key} is not an email`);
  const body = toBrevoText(copy.body, vars).replace(/\{\{ unsubscribe \}\}/g, "UNSUBSCRIBE_LINK");
  const html = toBrevoHtml(body).replace(/UNSUBSCRIBE_LINK/g, '<a href="{{ unsubscribe }}">Unsubscribe</a>');
  return {
    templateName: `DRAFT not approved - ${copy.key}`,
    subject: toBrevoText(copy.subject ?? "", vars),
    htmlContent: html,
    sender,
    isActive: false,
    tag: "ep-draft",
  };
}
