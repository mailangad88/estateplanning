import { ILLINOIS_PROBATE_FEES, type CountyProbateFees } from "@/config/illinois-probate-fees";
import { servedStates } from "@/config/firm";
import { getCities, getCounties, type City, type County, type Faq } from "@/lib/library";

/** Counties published for the states the firm serves. */
export function servedCounties(stateSlug?: string): County[] {
  const codes = servedStates();
  return getCounties(stateSlug).filter((c) => codes.includes(c.state.abbr));
}

/** "Cook County" -> the fee row for "Cook", when the clerk publishes a readable schedule. */
export function feesFor(c: County): CountyProbateFees | undefined {
  if (c.state.abbr !== "IL") return undefined;
  const short = c.name.replace(/ County$/, "");
  return ILLINOIS_PROBATE_FEES.find((f) => f.county === short);
}

/** Published city pages that sit in this county. */
export function citiesIn(c: County): City[] {
  return getCities(c.state.slug).filter((city) => city.county === c.name);
}

/** Strips the inline "(source: url)" from a note and returns the text and the link separately. */
export function splitSource(note: string): { text: string; source?: string } {
  const m = /\s*\(source: (https?:\/\/[^\s)]+)\)/.exec(note);
  return m ? { text: note.replace(m[0], "").trim(), source: m[1] } : { text: note };
}

/**
 * Questions people ask about probate in a specific county, answered only from the verified fields in the
 * county file and the clerk fee table. A question is skipped when we hold no verified answer for it.
 */
export function countyFaqs(c: County): Faq[] {
  const faqs: Faq[] = [];
  const fees = feesFor(c);
  if (c.probateCourt) {
    faqs.push({
      q: `Where is probate filed in ${c.name}?`,
      a: `Estates of ${c.name} residents are opened in the ${c.probateCourt.name}${c.probateCourt.address ? `, ${c.probateCourt.address}` : ""}. An Illinois estate is usually opened in the county where the person lived.`,
    });
  }
  if (fees) {
    faqs.push({
      q: `How much does it cost to open probate in ${c.name}?`,
      a: `The ${c.name} circuit clerk's fee schedule effective ${fees.effective} lists $${fees.estate} to open a decedent's estate${fees.appearance ? ` and a $${fees.appearance} appearance fee` : ""}. Filing fees are only part of the cost: publication, bond premiums and attorney fees are separate. Confirm the current amount with the clerk before filing.`,
    });
  }
  if (c.clerk) {
    faqs.push({
      q: `Where do I file a will after someone dies in ${c.name}?`,
      a: `Illinois law says whoever holds the original will must file it with the circuit court clerk of the proper county immediately after the death (755 ILCS 5/6-1). In ${c.name} that is the ${c.clerk.name}${c.clerk.address ? `, ${c.clerk.address}` : ""}.`,
    });
  }
  if (c.recorder) {
    faqs.push({
      q: `Where are deeds and transfer on death instruments recorded in ${c.name}?`,
      a: `Real estate documents for property in ${c.name}, including transfer on death instruments, are recorded by the ${c.recorder.name}${c.recorder.address ? `, ${c.recorder.address}` : ""}. A transfer on death instrument that is not recorded before the owner dies has no effect (755 ILCS 27/40).`,
    });
  }
  return faqs;
}
