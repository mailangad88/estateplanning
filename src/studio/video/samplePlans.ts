import type { Scene, VideoPlan } from "../../server/studio/types";

/**
 * Sample plans for previewing the templates (admin preview and the video/ project's default props).
 * Firm values are the placeholders from video/src/config.json; the office address is a stand-in until
 * the firm's address is filled in src/config/firm.ts.
 */

const END_CARD: VideoPlan["endCard"] = {
  url: "familyplanlaw.com/illinois-probate",
  firmName: "Family Plan Law",
  officeAddress: "Office address shown here, Illinois",
  advertisingLabel: "Attorney advertising.",
};

const DISCLAIMER = "General information about Illinois law, not legal advice. Watching this does not make you a client.";

/** Seconds for a caption read at about 2.6 words a second, plus a short beat to look at the screen. */
const secs = (caption: string, min = 4) => Math.max(min, Math.round((caption.split(/\s+/).length / 2.6 + 1.2) * 2) / 2);

type Draft = Omit<Scene, "id" | "beatId" | "durationSec"> & { durationSec?: number };
const scenes = (list: Draft[]): Scene[] =>
  list.map((s, i) => ({ ...s, id: `sc${i + 1}`, beatId: `b${i + 1}`, durationSec: s.durationSec ?? secs(s.caption) }));

export const SAMPLE_LONG_PLAN: VideoPlan = {
  format: "long",
  width: 1920,
  height: 1080,
  fps: 30,
  title: "What probate in Illinois looks like, step by step",
  disclaimer: DISCLAIMER,
  endCard: END_CARD,
  scenes: scenes([
    {
      template: "title",
      headline: "Probate in Illinois, step by step",
      body: "What the court does, how long it takes, and when you can skip it",
      icon: "courthouse",
      chapter: "Introduction",
      caption: "When someone dies in Illinois, their family often hears the word probate. Here is what it means, step by step, in plain language.",
    },
    {
      template: "question",
      headline: "Does every estate in Illinois have to go through probate?",
      icon: "question-mark",
      chapter: "Do you need probate?",
      caption: "The first question most families ask is whether they need probate at all. The answer depends on what the person owned, and how they owned it.",
    },
    {
      template: "statement",
      headline: "Probate is the court process for passing on property",
      body: "A judge confirms the will, names an executor, and oversees paying debts and handing out what is left.",
      icon: "gavel",
      chapter: "What probate is",
      caption: "Probate is the court process for passing on what someone owned in their own name. A judge confirms the will, names an executor, and watches over paying debts before the rest goes to family.",
    },
    {
      template: "points",
      headline: "Often skips probate",
      points: ["Accounts with a named beneficiary", "Property held in a living trust", "Joint property with survivorship", "A home with a recorded transfer on death instrument"],
      icon: "check-circle",
      caption: "Some property never goes through probate. Accounts with a named beneficiary, property in a living trust, joint property with survivorship, and a home with a recorded transfer on death instrument usually pass directly.",
    },
    {
      template: "myth",
      headline: "A will keeps you out of probate",
      points: ["Having a will means your family skips probate.", "A will is a set of instructions for the probate court. It does not avoid probate on its own."],
      chapter: "A common myth",
      caption: "A common myth is that a will keeps your family out of probate. In fact, a will is a set of instructions for the probate court. It does not avoid probate on its own.",
    },
    {
      template: "points",
      headline: "The main steps",
      points: ["File the original will with the circuit clerk", "Ask the court to name the executor", "Publish notice to creditors", "Pay valid debts and taxes", "Distribute what is left and close the estate"],
      icon: "list",
      chapter: "The steps",
      caption: "The main steps are: file the original will with the circuit clerk, ask the court to name the executor, publish notice to creditors, pay valid debts and taxes, then distribute what is left and close the estate.",
    },
    {
      template: "statement",
      headline: "Plan on six months or more",
      body: "Creditors get at least six months from the first published notice to file claims, so most estates stay open for most of a year.",
      icon: "hourglass",
      chapter: "How long it takes",
      caption: "How long does it take? Creditors get at least six months from the first published notice to file claims, so most Illinois estates stay open for most of a year.",
    },
    {
      template: "example",
      headline: "The Rivera family",
      body: "Ana left a house in her own name and a bank account with no beneficiary. Her son files her will and opens probate in her county. Her retirement account, which named him as beneficiary, is paid to him directly.",
      fictional: true,
      icon: "family",
      chapter: "An example",
      caption: "Here is a made up example. Ana left a house in her own name and a bank account with no beneficiary, so her son opens probate. Her retirement account named him as beneficiary, so it is paid to him directly.",
    },
    {
      template: "statement",
      headline: "Small estates can use an affidavit",
      body: "If there is no real estate and the estate is $150,000 or less, a small estate affidavit may replace a full probate case.",
      icon: "document",
      chapter: "Small estates",
      caption: "For smaller estates there is a shortcut. If there is no real estate and the estate is one hundred fifty thousand dollars or less, a small estate affidavit may replace a full probate case.",
    },
    {
      template: "cta",
      headline: "See the Illinois probate guide",
      icon: "arrow-right",
      chapter: "Next step",
      caption: "To see each step, the county filing fees and a checklist for executors, visit our Illinois probate guide.",
      durationSec: 7,
    },
  ]),
};

export const SAMPLE_SHORT_PLAN: VideoPlan = {
  format: "short",
  width: 1080,
  height: 1920,
  fps: 30,
  title: "Does a will avoid probate in Illinois?",
  disclaimer: DISCLAIMER,
  endCard: END_CARD,
  scenes: scenes([
    {
      template: "question",
      headline: "Does a will keep my family out of probate?",
      icon: "will",
      caption: "Does having a will keep your family out of probate in Illinois?",
      durationSec: 4.5,
    },
    {
      template: "myth",
      headline: "A will avoids probate",
      points: ["A will skips the court.", "A will is instructions for the probate court."],
      caption: "Not on its own. A will is a set of instructions for the probate court, not a way around it.",
      durationSec: 7,
    },
    {
      template: "points",
      headline: "What usually skips probate",
      points: ["Named beneficiaries", "A funded living trust", "Transfer on death deed"],
      icon: "check-circle",
      caption: "What usually skips probate: accounts with named beneficiaries, a funded living trust, and a transfer on death instrument for your home.",
      durationSec: 9,
    },
    {
      template: "example",
      headline: "Ana's house went to probate",
      body: "Her will named her son. Her house was in her name alone, so he still had to open a probate case.",
      fictional: true,
      icon: "house",
      caption: "Made up example. Ana's will named her son, but her house was in her name alone, so he still had to open probate.",
      durationSec: 8,
    },
    {
      template: "statement",
      headline: "Check how each asset is titled",
      body: "Title and beneficiary forms decide what skips probate.",
      icon: "magnifier",
      caption: "So check how each asset is titled and who is named on each beneficiary form.",
      durationSec: 5.5,
    },
    {
      template: "cta",
      headline: "Read the Illinois probate guide",
      icon: "arrow-right",
      caption: "Read the full Illinois probate guide at the link.",
      durationSec: 5,
    },
  ]),
};
