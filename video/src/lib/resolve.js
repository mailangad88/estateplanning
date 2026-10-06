// Pure JS (no imports) so both the Remotion bundle and the Node render script share it.

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function below1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + " hundred"); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "")); }
  else if (n > 0 || parts.length === 0) parts.push(ONES[n]);
  return parts.join(" ");
}

export function numberToWords(n) {
  if (n === 0) return "zero";
  const out = [];
  const m = Math.floor(n / 1e6), t = Math.floor((n % 1e6) / 1e3), r = n % 1e3;
  if (m) out.push(below1000(m) + " million");
  if (t) out.push(below1000(t) + " thousand");
  if (r) out.push(below1000(r));
  return out.join(" ");
}

export const usd = (n) => "$" + n.toLocaleString("en-US");
export const usdShort = (n) =>
  n >= 1e6 && n % 1e5 === 0 ? "$" + n / 1e6 + " million" : usd(n);

/** Replace {{tokens}} using config + facts. Leftover [STATE] becomes "your state". */
export function resolveText(str, { config, facts }) {
  return str
    .replace(/\{\{SITE_URL\}\}/g, config.siteUrl)
    .replace(/\{\{FIRM_SHORT_NAME\}\}/g, config.firmName)
    .replace(/\{\{ATTORNEY_ADVERTISING_LABEL\}\}/g, config.advertisingLabel)
    .replace(/\{\{UPLOAD_DATE_ISO8601\}\}/g, config.uploadDate)
    .replace(/\{\{taxYear\}\}/g, String(facts.taxYear))
    .replace(/\{\{(usd|usdShort|words|pct|pctWords):(\w+)\}\}/g, (_, kind, key) => {
      const v = facts[key];
      if (v === undefined) throw new Error("Unknown fact " + key);
      if (kind === "usd") return usd(v);
      if (kind === "usdShort") return usdShort(v);
      if (kind === "words") return numberToWords(v) + " dollars";
      if (kind === "pct") return v + "%";
      return numberToWords(v) + " percent";
    })
    .replace(/\[STATE\]/g, "your state");
}

export function resolveDeep(o, ctx) {
  if (typeof o === "string") return resolveText(o, ctx);
  if (Array.isArray(o)) return o.map((v) => resolveDeep(v, ctx));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, resolveDeep(v, ctx)]));
  return o;
}

export function cleanTitle(s) {
  return s.replace(/^\d+\.\s*/, "").trim();
}
