/**
 * The signed copy and signature certificate for the built-in e-sign, as one self-contained printable HTML page
 * (no PDF library). The same function renders the copy the client downloads and the copy stored with the case
 * at signing, so they match. The certificate lists, per signer, the typed name, time, IP prefix, device
 * summary, consent version and the hashes of exactly what was signed.
 */
import type { Engagement, SignatureRecord } from "@/server/types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (iso: string) => `${new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC`;

export interface SignedCopyInput {
  engagement: Engagement;
  signatures: SignatureRecord[];
  firmName: string;
  attorneyName: string;
  /** Set once the attorney countersigned */
  countersignedAt?: string;
  letterSha256: string;
}

export function certificateRows(input: SignedCopyInput): { label: string; value: string }[][] {
  return input.signatures.map((s) => [
    { label: "Signer", value: `${s.expectedName} (${s.signerRole === "spouse" ? "second client" : "client"})` },
    { label: "Typed signature", value: s.typedName },
    { label: "Signed", value: when(s.signedAt) },
    { label: "Consent to electronic records", value: `${s.consentVersion}, given ${when(s.consentAt)}` },
    { label: "Network", value: s.ipPrefix ?? "not recorded" },
    { label: "Device", value: s.userAgent ?? "not recorded" },
    { label: "Agreement text sha256", value: s.letterSha256 },
    ...(s.attachmentSha256 ? [{ label: "Attached agreement (PDF) sha256", value: s.attachmentSha256 }] : []),
    { label: "Signed document sha256", value: s.documentSha256 },
  ]);
}

function certificateHtml(input: SignedCopyInput): string {
  const blocks = certificateRows(input)
    .map((rows) => `<table class="cert">${rows.map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join("")}</table>`)
    .join("");
  const counter = input.countersignedAt
    ? `<p>Countersigned by ${esc(input.attorneyName)} for ${esc(input.firmName)} on ${esc(when(input.countersignedAt))}.</p>`
    : `<p>Awaiting countersignature by ${esc(input.attorneyName)}.</p>`;
  return `<section class="certificate"><h2>Signature certificate</h2>
<p>Engagement ${esc(input.engagement.id)}. Signed electronically on this site with the built-in e-sign. Each signer agreed to use electronic records, typed their name and confirmed they intended to sign.</p>
${blocks}${counter}</section>`;
}

const STYLE = `body{font:16px/1.55 Georgia,"Iowan Old Style",serif;color:#1b2a30;background:#fff;max-width:760px;margin:24px auto;padding:0 16px}
pre{white-space:pre-wrap;font:inherit}h1{font-size:1.4rem}h2{font-size:1.15rem;margin-top:32px}
.cert{border-collapse:collapse;width:100%;margin:12px 0 20px;font:13px/1.4 system-ui,sans-serif}.cert th,.cert td{border:1px solid #e3dcd0;padding:6px 8px;text-align:left;vertical-align:top}
.cert th{width:38%;background:#f3ebdf}.cert td{word-break:break-all}.bar{display:flex;gap:12px;margin:0 0 24px;font-family:system-ui,sans-serif}
.bar button,.bar a{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #17505b;background:#17505b;color:#fff;text-decoration:none;cursor:pointer}
.bar a{background:#fff;color:#17505b}.att{font-family:system-ui,sans-serif;font-size:14px;background:#f3ebdf;padding:10px 12px;border-radius:8px}
@media print{.bar{display:none}body{margin:0}}`;

/** The whole signed copy. `download` adds no script, so the stored copy is plain markup. */
export function renderSignedCopyHtml(input: SignedCopyInput, opts: { printBar?: boolean; attachmentUrl?: string } = {}): string {
  const e = input.engagement;
  const attachment = e.attachment
    ? `<p class="att">Attached and signed with this letter: <strong>${esc(e.attachment.name)}</strong> (sha256 ${esc(e.attachment.sha256)})${opts.attachmentUrl ? `. <a href="${esc(opts.attachmentUrl)}">Open the PDF</a>` : ""}</p>`
    : "";
  const bar = opts.printBar
    ? `<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button><a href="/client">Back to my case</a></div>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Signed engagement agreement</title><style>${STYLE}</style></head><body>${bar}
<h1>Signed engagement agreement</h1><p>${esc(input.firmName)} · responsible attorney ${esc(input.attorneyName)}</p>
<pre>${esc(e.letter ?? "")}</pre>${attachment}${certificateHtml(input)}</body></html>`;
}

export function renderCertificateHtml(input: SignedCopyInput): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signature certificate</title><style>${STYLE}</style></head><body>${certificateHtml(input)}</body></html>`;
}
