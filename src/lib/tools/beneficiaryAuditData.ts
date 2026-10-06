/** Static facts and plain-English text for the beneficiary audit. Attorney to review all text. */

export interface Sourced {
  asOf: string;
  confidence: "high" | "medium" | "unverified";
  source: string;
  cite: string;
}

export const COMMUNITY_PROPERTY_STATES: Sourced & { states: string[] } = {
  states: ["AZ", "CA", "ID", "LA", "NV", "NM", "TX", "WA", "WI"],
  asOf: "2026-10-06",
  confidence: "high",
  source: "https://www.irs.gov/publications/p555",
  cite: "IRS Publication 555, Community Property",
};

export type Sev = "high" | "medium" | "low";

export interface FlagDef extends Sourced {
  sev: Sev;
  text: string;
  ask: string;
}

const A = "2026-10-06";

export const FLAG_DEFS: Record<string, FlagDef> = {
  no_designation: {
    sev: "high",
    text: "If no valid beneficiary is on file, the account usually follows the plan's or company's default rules, or goes through your estate.",
    ask: "Ask the plan or company who is on file today and request a change-of-beneficiary form.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "IRS, Retirement topics: Beneficiary",
  },
  deceased_beneficiary: {
    sev: "high",
    text: "If the person named has died, the account may fall to a backup beneficiary, a default order set by the plan, or your estate.",
    ask: "Ask the plan or company what happens if the main beneficiary has died, and request a new form.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "IRS, Retirement topics: Beneficiary",
  },
  ex_spouse: {
    sev: "high",
    text: "For many accounts, especially workplace retirement plans and some life insurance, the plan pays whoever is on the form, even after a divorce. The Supreme Court has held that federal law (ERISA) can require payment to a former spouse named on the form despite a divorce decree or state law. Rules for IRAs and other accounts vary by state.",
    ask: "Ask the plan for a change-of-beneficiary form and confirm in writing who is on file.",
    asOf: A, confidence: "high", source: "https://supreme.justia.com/cases/federal/us/532/141/", cite: "Egelhoff v. Egelhoff (2001); Kennedy v. Plan Administrator for DuPont (2009)",
  },
  minor_named: {
    sev: "high",
    text: "A child under 18 generally can't take ownership of an account directly. A court may have to appoint someone to manage the money until the child is an adult. Parents often ask about naming a custodian under UTMA or a trust instead.",
    ask: "Ask an attorney whether a custodian or a trust fits your family, and what your state allows.",
    asOf: A, confidence: "medium", source: "https://www.uniformlaws.org", cite: "Uniform Transfers to Minors Act",
  },
  special_needs_direct: {
    sev: "high",
    text: "Money left directly to a person who receives SSI or Medicaid can interrupt benefits. Families often name a special needs trust instead.",
    ask: "Ask an attorney about a special needs trust before changing the form.",
    asOf: A, confidence: "high", source: "https://www.ssa.gov/ssi/text-resources-ussi.html", cite: "Social Security Administration, SSI resource limits",
  },
  estate_named: {
    sev: "medium",
    text: "Naming your estate can send an account through probate and can shorten the time heirs have to withdraw retirement money. A person or a trust is often a better fit.",
    ask: "Ask whether a named person or a trust can be listed instead of your estate.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/publications/p590b", cite: "IRS Publication 590-B",
  },
  estate_defeats_pod: {
    sev: "medium",
    text: "A payable-on-death or transfer-on-death account exists to skip probate. Naming your estate undoes that.",
    ask: "Ask the bank or broker to list a person or trust instead, if skipping probate is your goal.",
    asOf: A, confidence: "medium", source: "https://www.law.cornell.edu/wex/transfer_on_death_account", cite: "Transfer-on-death accounts, general rule",
  },
  trust_named_check: {
    sev: "medium",
    text: "A trust can be a sound beneficiary, but its wording affects how fast retirement money must be paid out and how it is taxed. This is a conversation prompt, not a defect.",
    ask: "Ask an attorney whether the trust is written to work as a beneficiary of this account.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/publications/p590b", cite: "IRS Publication 590-B",
  },
  spousal_consent: {
    sev: "high",
    text: "Federal law generally makes your spouse the beneficiary of a workplace retirement plan unless the spouse signs a written consent, witnessed by a notary or a plan representative. This may already be satisfied if a waiver is on file.",
    ask: "Ask the plan whether a spousal waiver is on file.",
    asOf: A, confidence: "high", source: "https://www.law.cornell.edu/uscode/text/29/1055", cite: "29 U.S.C. 1055",
  },
  hsa_nonspouse: {
    sev: "medium",
    text: "A non-spouse who inherits a health savings account generally stops treating it as an HSA and owes tax on its value.",
    ask: "Ask the HSA custodian how a non-spouse beneficiary is treated.",
    asOf: A, confidence: "high", source: "https://www.irs.gov/publications/p969", cite: "IRS Publication 969",
  },
  ten_year_rule: {
    sev: "low",
    text: "Adult children who inherit a retirement account generally must empty it within 10 years of the owner's death, and may owe annual withdrawals during that time if the owner had already started required distributions. For information only.",
    ask: "Ask a tax adviser how the 10-year rule affects the people you named.",
    asOf: A, confidence: "high", source: "https://www.irs.gov/publications/p590b", cite: "IRS Publication 590-B; final regulations, 89 Fed. Reg. 58886",
  },
  community_property_check: {
    sev: "medium",
    text: "In community property states, a spouse may have a legal interest in part of a retirement account or policy even when someone else is named. This is worth a check.",
    ask: "Ask an attorney how community property rules apply to this account.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/publications/p555", cite: "IRS Publication 555",
  },
  no_contingent: {
    sev: "medium",
    text: "With no backup beneficiary, if the main person can't inherit, the account may fall to a default order or your estate.",
    ask: "Ask the plan or company to add a contingent beneficiary.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "IRS, Retirement topics: Beneficiary",
  },
  contingent_unknown: {
    sev: "low",
    text: "You aren't sure whether a backup beneficiary is listed. That is worth confirming.",
    ask: "Ask the plan or company to send a copy of the beneficiary page on file.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "IRS, Retirement topics: Beneficiary",
  },
  stale_review: {
    sev: "low",
    text: "It has been more than five years since you looked at this form. Families and laws change in that time.",
    ask: "Log in or call and read back the current beneficiary page.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "General practice",
  },
  aging_review: {
    sev: "low",
    text: "It has been three to five years since you looked at this form.",
    ask: "Check the current beneficiary page next time you log in.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "General practice",
  },
  never_reviewed: {
    sev: "low",
    text: "You haven't looked at this form, or don't remember doing so. The form may be older than your current plans.",
    ask: "Ask the plan or company for a copy of the beneficiary page on file.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "General practice",
  },
  life_event_since: {
    sev: "medium",
    text: "A marriage, divorce, birth, death or new plan since your last update is the usual reason a form stops matching what you want.",
    ask: "Review every form against your current wishes.",
    asOf: A, confidence: "medium", source: "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary", cite: "General practice",
  },
};
