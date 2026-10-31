import { SITE_DISCLAIMER, SITE_DISCLAIMER_ES } from "@/config/firm";

/** The sitewide disclaimer, shown on every public form and on /book. */
export default function FormDisclaimer({ lang }: { lang?: "es" }) {
  return <p className="notice form-disclaimer">{lang === "es" ? SITE_DISCLAIMER_ES : SITE_DISCLAIMER}</p>;
}
