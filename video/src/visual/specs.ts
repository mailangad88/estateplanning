import type { Item, Spec, Tone } from "./templates";

const I = (icon: string, label?: string, o: Partial<Item> = {}): Item => ({ icon, label, ...o });
const calEnd = (n: number) => n;

/** Per-video, per-scene visual recipes. Scenes not listed fall back to their iconHints. */
export const specs: Record<number, Record<string, Spec>> = {
  1: {
    s1: { k: "row", items: [I("house", "Your things", { badge: "question-mark" })] },
    s2: { k: "row", arrows: true, items: [I("family-tree", "Default rulebook"), I("gavel", "Your state's law", { tag: "intestacy" })] },
    s3: { k: "ladder", rows: [{ label: "Spouse and children" }, { label: "Parents" }, { label: "Brothers and sisters" }, { label: "More distant relatives" }] },
    s4: { k: "row", items: [
      I("partner", "Partner", { tag: "no claim", tagTone: "muted", tone: "muted" }),
      I("friend", "Friend", { tag: "no claim", tagTone: "muted", tone: "muted" }),
      I("charity", "Charity", { tag: "no claim", tagTone: "muted", tone: "muted" }),
      I("child", "Minor children", { tag: "guardian?", tagTone: "accent", highlight: true }),
    ] },
    s5: { k: "row", arrows: true, items: [I("document", "Your estate"), I("courthouse", "Court appoints"), I("clock", "Often months")] },
    s6: { k: "row", check: true, items: [I("will", "Will"), I("power-of-attorney", "Power of attorney"), I("health-directive", "Health care directive")] },
  },
  2: {
    s1: { k: "timeline", ticks: [{ at: 0, label: "Month 0" }, { at: 0.25, label: "Month 3" }, { at: 0.5, label: "Month 6" }, { at: 0.75, label: "Month 9" }, { at: 1, label: "Month 12+" }], bars: [{ from: 0, to: 1, label: "Probate: settling an estate" }] },
    s2: { k: "flow", label: "Weeks 1 to 4", from: [I("will", "Will"), I("petition", "Petition")], to: [I("courthouse", "Court opens the case")] },
    s3: { k: "timeline", ticks: [{ at: 0, label: "Month 1", icon: "mailbox" }, { at: 0.33, label: "Month 2", icon: "newspaper" }, { at: 0.66, label: "Month 3" }, { at: 1, label: "Month 4" }], bars: [{ from: 0, to: 1, label: "Creditor claims period", tone: "sage" }] },
    s4: { k: "row", check: true, items: [I("house", "House", { tag: "appraised" }), I("bank", "Accounts", { tag: "balance listed" }), I("car", "Vehicle", { tag: "valued" })] },
    s5: { k: "row", arrows: true, items: [I("tax-form", "Final tax returns"), I("calendar", "Filed by due dates")] },
    s6: { k: "flow", from: [I("folder", "Estate")], to: [I("person", "Beneficiary"), I("person", "Beneficiary", { tone: "sage" }), I("person", "Beneficiary", { tone: "gold" })] },
    s7: { k: "bars", bars: [{ label: "Simple estate", value: 0.4, note: "Shorter", tone: "sage" }, { label: "Complex estate", value: 0.9, note: "Longer" }], chips: [{ text: "Closed", icon: "folder", x: 0.5, y: 0.2 }] },
  },
  3: {
    s1: { k: "row", arrows: true, items: [I("person", "You"), I("trust-box", "Living trust", { tag: "container" })] },
    s2: { k: "row", arrows: true, items: [I("person", "You", { tags: ["Grantor", "Trustee", "Beneficiary"] }), I("family", "Later beneficiaries")] },
    s3: { k: "flow", from: [I("house", "House", { tag: "new deed" }), I("bank", "Bank"), I("brokerage", "Brokerage")], to: [I("trust-box", "Trust")] },
    s4: { k: "flow", from: [I("person", "You", { dim: true }), I("person", "Successor trustee", { tone: "sage" })], to: [I("trust-box", "Trust")] },
    s5: { k: "flow", from: [I("trust-box", "Trust opens")], to: [I("family", "Family"), I("courthouse", "Court", { dim: true, noArrow: true })] },
    s6: { k: "row", items: [I("retirement", "401(k)", { tag: "beneficiary form", tone: "gold" }), I("coins", "Cost to set up"), I("slider", "Revocable", { tag: "you can change it", tone: "sage" })] },
  },
  4: {
    s1: { k: "calendar", days: 5, unit: "Year", ranges: [{ from: 1, to: 5, label: "5-year look-back window" }] },
    s2: { k: "row", items: [I("bill", "Care costs grow"), I("medicare-card", "Medicare", { tag: "limited", tagTone: "gold", tone: "muted" }), I("medicaid-card", "Medicaid", { tag: "needs-based" })] },
    s3: { k: "timeline", ticks: [{ at: 0.1, label: "Gift", icon: "gift" }, { at: 0.7, label: "Application", icon: "bank" }], bars: [{ from: 0, to: 0.7, label: "5-year window" }, { from: 0.7, to: 1, label: "Penalty period", tone: "clay" }] },
    s4: { k: "row", items: [I("gift", "Gift to child", { tag: "may count", tagTone: "gold" }), I("house", "House retitle", { tag: "may count", tagTone: "gold" }), I("dollar", "Cash transfer", { tag: "may count", tagTone: "gold" })] },
    s5: { k: "row", items: [I("partner", "Spouse and home", { tag: "may be exempt", tone: "sage", tagTone: "sage" }), I("child", "Disabled child", { tag: "trust", tone: "sage", tagTone: "sage" })] },
    s6: { k: "timeline", ticks: [{ at: 0, label: "Start early" }, { at: 0.6, label: "Start late" }, { at: 1, label: "Need care" }], bars: [{ from: 0, to: 1, label: "More options", tone: "sage" }, { from: 0.6, to: 1, label: "Fewer", tone: "muted" }] },
  },
  5: {
    s1: { k: "row", items: [I("parent", "Parent"), I("child", "Adult child", { tone: "sage" }), I("shield", "Benefits", { tag: "at risk", tagTone: "gold", tone: "gold" })] },
    s2: { k: "bars", line: { value: 0.35, label: "Resource limit: {{usdShort:ssiResourceLimitIndividual}}" }, bars: [{ label: "Savings", value: 0.25 }, { label: "With inheritance", value: 0.85, icon: "arrow-down" }] },
    s3: { k: "row", arrows: true, items: [I("dollar", "Inheritance"), I("trust-box", "Trust holds it"), I("trustee", "Trustee pays", { tone: "sage" })] },
    s4: { k: "row", items: [I("therapy", "Therapy"), I("plane", "Travel"), I("phone", "Phone"), I("music", "Music")] },
    s5: { k: "compare", left: { title: "Third-party trust", icon: "trust-box", lines: ["Funded by parents or others"] }, right: { title: "First-party trust", icon: "trust-box", tone: "gold", lines: ["Funded with the person's own assets", "Payback to the state"] } },
    s6: { k: "row", arrows: true, items: [I("letter", "Letter of intent"), I("pen", "In your own words")] },
  },
  6: {
    s1: { k: "row", items: [I("will", "Will"), I("question-mark", "Who wins?", { tone: "gold" }), I("form", "Beneficiary form")] },
    s2: { k: "flow", from: [I("retirement", "Retirement account"), I("insurance", "Life insurance"), I("will", "Will", { dim: true, noArrow: true })], to: [I("person", "Named person", { tone: "sage" })] },
    s3: { k: "row", arrows: true, items: [I("form", "Form names an ex", { dim: true, tag: "old form" }), I("form", "Form names current", { tone: "sage", tag: "updated", tagTone: "sage" })] },
    s4: { k: "row", check: true, items: [I("check", "Check"), I("folder", "Back up"), I("pen", "Update")] },
  },
  7: {
    s1: { k: "row", items: [I("person", "Executor", { blank: true }), I("person", "Trustee", { blank: true }), I("person", "Agent", { blank: true })] },
    s2: { k: "row", active: 0, items: [I("will", "Executor", { tag: "after death" }), I("person", "Trustee", { blank: true }), I("person", "Agent", { blank: true })] },
    s3: { k: "row", active: 1, items: [I("will", "Executor", { tag: "after death" }), I("trust-box", "Trustee", { tag: "manages the trust" }), I("person", "Agent", { blank: true })] },
    s4: { k: "row", active: 2, items: [I("will", "Executor", { tag: "after death" }), I("trust-box", "Trustee", { tag: "manages the trust" }), I("pen", "Agent", { tag: "while alive" })] },
    s5: { k: "row", active: 3, cols: 4, items: [I("will", "Executor"), I("trust-box", "Trustee"), I("pen", "Agent"), I("heart", "Health care directive", { tag: "medical choices" })] },
  },
  8: {
    s1: { k: "flow", from: [I("question-mark", "Your goals")], to: [I("will", "Will"), I("trust-box", "Trust"), I("scale", "Both")] },
    s2: { k: "flow", from: [I("child", "Minor children?")], to: [I("will", "Name a guardian in a will", { tone: "sage" })] },
    s3: { k: "flow", from: [I("house", "Real estate or probate concerns?")], to: [I("trust-box", "A trust may help", { tone: "sage" }), I("courthouse", "Court", { tag: "probate?", tagTone: "gold" })] },
    s4: { k: "flow", from: [I("calendar", "Want control over timing?")], to: [I("coins", "Trusts add control", { tone: "sage", tag: "staged payouts" })] },
    s5: { k: "row", items: [I("open-book", "Wills can become public", { tone: "gold" }), I("closed-book", "Trusts stay private", { tone: "sage" })] },
    s6: { k: "flow", from: [I("will", "Pour-over will"), I("power-of-attorney", "Powers of attorney"), I("trust-box", "Trust")], to: [I("scale", "A complete plan", { tone: "sage" })] },
  },
  9: {
    s1: { k: "row", items: [I("trust-box", "Your trust", { tag: "0% funded", tagTone: "gold" })] },
    s2: { k: "row", arrows: true, items: [I("house", "Real estate"), I("deed", "New deed", { tag: "recorded" })] },
    s3: { k: "row", arrows: true, items: [I("bank", "Bank account"), I("trust-box", "Trust", { tag: "retitle or POD" })] },
    s4: { k: "row", arrows: true, items: [I("chart", "Brokerage"), I("trust-box", "Trust", { tag: "retitle" })] },
    s5: { k: "row", arrows: true, items: [I("retirement", "Retirement"), I("lock", "Beneficiary form", { tone: "gold", tag: "name beneficiaries" })] },
    s6: { k: "row", items: [I("life-insurance", "Life insurance", { tag: "check beneficiary" })] },
    s7: { k: "flow", from: [I("furniture", "Furniture"), I("ring", "Jewelry"), I("key", "Keepsakes")], to: [I("document", "One assignment")] },
  },
  10: {
    s1: { k: "compare", left: { title: "Probate", icon: "courthouse", lines: ["Time", "Cost", "Privacy", "Effort"] }, right: { title: "Living trust", icon: "trust-box", lines: ["Time", "Cost", "Privacy", "Effort"] } },
    s2: { k: "bars", bars: [{ label: "Probate", value: 0.9, note: "Months to a year+", tone: "clay" }, { label: "Trust", value: 0.45, note: "Often faster", tone: "sage" }] },
    s3: { k: "bars", bars: [{ label: "Probate", value: 0.75, note: "Court + attorney fees", tone: "clay", icon: "coins" }, { label: "Trust", value: 0.5, note: "Higher setup, lower later", tone: "sage", icon: "coins" }] },
    s4: { k: "row", items: [I("open-book", "Probate: public", { tone: "gold" }), I("closed-book", "Trust: private", { tone: "sage" })] },
    s5: { k: "flow", from: [I("puzzle", "Assets to add")], to: [I("trust-box", "Trust", { tag: "needs funding", tagTone: "gold" })] },
  },
  11: {
    s1: { k: "row", items: [I("parent", "Parents", { dim: true }), I("child", "Your children", { highlight: true })] },
    s2: { k: "row", items: [I("gavel", "A judge decides"), I("scale", "Best interests of the child"), I("relatives", "Relatives step forward")] },
    s3: { k: "row", arrows: true, items: [I("will", "Your will", { tag: "names a guardian", tone: "sage", tagTone: "sage" }), I("check-circle", "Court considers it", { tone: "sage" })] },
    s4: { k: "row", items: [I("person", "First choice", { tone: "sage" }), I("person", "Backup")] },
    s5: { k: "row", items: [I("person", "Guardian", { tag: "raises the children", tone: "sage", tagTone: "sage" }), I("trust-box", "Trust", { tag: "manages money" }), I("trustee", "Trustee")] },
  },
  12: {
    s1: { k: "calendar", days: 30, ranges: [], items: [I("hand-heart", "One step at a time")] },
    s2: { k: "calendar", days: 30, ranges: [{ from: 1, to: 3, label: "Days 1 to 3" }], items: [I("certificate", "Death certificates", { tag: "get several copies" })] },
    s3: { k: "row", items: [I("key", "Secure the home"), I("paw", "Pets"), I("mail", "Mail")] },
    s4: { k: "row", arrows: true, items: [I("folder", "Key papers"), I("will", "Locate the will")] },
    s5: { k: "calendar", days: 30, ranges: [{ from: 4, to: 14, label: "Weeks 1 to 2" }], items: [I("speech", "Talk to an attorney if needed")] },
    s6: { k: "row", check: true, items: [I("bill", "Bills"), I("notebook", "Keep a log")] },
    s7: { k: "calendar", days: 30, ranges: [{ from: 15, to: 30, label: "Weeks 3 to 4" }], check: true, items: [I("form", "Claim forms"), I("retirement", "Beneficiary checks")] },
    s8: { k: "row", items: [I("house", "Home sale", { badge: "pause" }), I("gift", "Big gifts", { badge: "pause" })] },
    s9: { k: "timeline", ticks: [{ at: 0.08, label: "Case opens", icon: "courthouse" }], bars: [{ from: 0.08, to: 0.95, label: "Court deadlines vary", tone: "muted" }] },
    s10: { k: "row", items: [I("hands", "Ask for help", { badge: "light" })] },
  },
  13: {
    s1: { k: "bars", bars: [{ label: "Federal {{taxYear}}", value: 0.9, note: "{{usdShort:fedExemptionIndividual}}" }], chips: [{ text: "Per person", x: 0.68, y: 0.45 }] },
    s2: { k: "bars", line: { value: 0.65, label: "Exemption" }, bars: [{ label: "Estate value", value: 0.9, tone: "accent" }], chips: [{ text: "Top rate {{pct:topEstateTaxRate}}", x: 0.72, y: 0.3 }] },
    s3: { k: "bars", arrow: true, bars: [{ label: "First spouse", value: 0.4, ghost: 0.4, note: "Unused" }, { label: "Surviving spouse", value: 0.8, tone: "sage", note: "Uses both" }] },
    s4: { k: "bars", bars: [{ label: "Lifetime exemption", value: 0.85, icon: "gift" }], chips: [{ text: "{{usdShort:annualGiftExclusion}} per person", x: 0.7, y: 0.4 }] },
    s5: { k: "bars", bars: [{ label: "Federal", value: 0.9 }, { label: "Your state", value: 0.35, tone: "gold", note: "May be lower", icon: "map-outline" }] },
    s6: { k: "row", arrows: true, items: [I("calendar", "{{taxYear}}"), I("calendar", "Next year", { tag: "? check", tagTone: "gold", tone: "gold" })] },
  },
  14: {
    s1: { k: "flow", label: "gives authority", from: [I("person", "You")], to: [I("person", "Your agent", { tone: "sage" })] },
    s2: { k: "timeline", zones: [{ from: 0.45, to: 0.8, label: "Incapacity" }], ticks: [{ at: 0.05, label: "Signed" }, { at: 0.6, label: "Incapacity" }], bars: [{ from: 0.05, to: 1, label: "Durable: continues", tone: "accent" }] },
    s3: { k: "row", check: true, items: [I("bill", "Bills"), I("bank", "Accounts"), I("tax-form", "Taxes"), I("house", "Property")] },
    s4: { k: "row", items: [I("will", "Sign your will", { strike: true, tag: "cannot", tone: "muted" }), I("clock", "Act after death", { strike: true, tag: "cannot", tone: "muted" }), I("handshake", "Self-dealing", { strike: true, tag: "cannot", tone: "muted" })] },
    s5: { k: "row", items: [I("document", "Gifting power", { tag: "must be listed", highlight: true }), I("bank", "Bank form", { tag: "may need its own" })] },
  },
  15: {
    s1: { k: "row", items: [I("person", "Pat"), I("spouse", "New spouse", { tone: "sage" }), I("children", "Kids from before", { tone: "gold" }), I("house", "Home")] },
    s2: { k: "flow", from: [I("house", "Pat's estate")], to: [I("spouse", "Spouse", { tone: "sage" })] },
    s3: { k: "flow", from: [I("spouse", "Spouse", { tone: "sage", tag: "new will" })], to: [I("question-mark", "Their choice", { tone: "gold" }), I("children", "Kids", { dim: true, noArrow: true })] },
    s4: { k: "flow", from: [I("house", "Pat's estate")], to: [I("children", "Kids", { tone: "gold" }), I("spouse", "Spouse", { dim: true, noArrow: true })] },
    s5: { k: "flow", from: [I("trust-box", "Trust")], to: [I("spouse", "Spouse first", { tone: "sage" }), I("children", "Then the kids", { tone: "gold" })] },
    s6: { k: "row", items: [I("scale", "Balanced"), I("trustee", "Neutral trustee"), I("list", "Clear terms")] },
    s7: { k: "flow", from: [I("form", "Beneficiary forms"), I("deed", "Titles")], to: [I("trust-box", "Your plan", { dim: true })] },
  },
};

export const defaultSpec = (icons: string[]): Spec => ({
  k: "row",
  items: icons.filter((i) => !["button", "scale"].includes(i)).slice(0, 4).map((i) => ({ icon: i })),
});
export type { Tone };
