/**
 * Plan finder quiz. Wording is educational: it describes what people in a similar
 * situation commonly discuss with an attorney, never what the visitor "needs".
 * Question copy must be approved by the attorney before launch.
 */

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  id: keyof QuizAnswers;
  prompt: string;
  help?: string;
  options: QuizOption[];
}

export interface QuizAnswers {
  matterType: "new_plan" | "update_plan" | "after_death" | "elder_care" | "not_sure";
  maritalStatus: "single" | "married" | "partnered" | "divorced" | "widowed";
  children: "none" | "minors" | "adults" | "both";
  specialNeeds: "yes" | "no";
  blendedFamily: "yes" | "no";
  ownsHome: "yes" | "no";
  ownsBusiness: "yes" | "no";
  outOfStateProperty: "yes" | "no";
  assetRange: "under_250k" | "250k_1m" | "1m_5m" | "over_5m" | "prefer_not";
  existingDocuments: "none" | "will_only" | "trust" | "not_sure";
  urgency: "exploring" | "this_month" | "health_event" | "recent_death";
}

const yesNo: QuizOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "matterType",
    prompt: "What brings you here today?",
    options: [
      { value: "new_plan", label: "I want to create my first estate plan" },
      { value: "update_plan", label: "I want to update an existing plan" },
      { value: "after_death", label: "Someone has passed away and I'm handling their estate" },
      { value: "elder_care", label: "I'm planning for long-term care or an aging parent" },
      { value: "not_sure", label: "I'm not sure yet" },
    ],
  },
  {
    id: "maritalStatus",
    prompt: "What is your relationship status?",
    options: [
      { value: "single", label: "Single" },
      { value: "married", label: "Married" },
      { value: "partnered", label: "Long-term partner, not married" },
      { value: "divorced", label: "Divorced or separated" },
      { value: "widowed", label: "Widowed" },
    ],
  },
  {
    id: "children",
    prompt: "Do you have children?",
    options: [
      { value: "none", label: "No" },
      { value: "minors", label: "Yes, under 18" },
      { value: "adults", label: "Yes, all adults" },
      { value: "both", label: "Both minors and adults" },
    ],
  },
  { id: "specialNeeds", prompt: "Does anyone who depends on you have special needs or receive disability benefits?", options: yesNo },
  { id: "blendedFamily", prompt: "Do you or your spouse have children from a previous relationship?", options: yesNo },
  { id: "ownsHome", prompt: "Do you own a home?", options: yesNo },
  { id: "ownsBusiness", prompt: "Do you own all or part of a business?", options: yesNo },
  { id: "outOfStateProperty", prompt: "Do you own real estate in another state?", options: yesNo },
  {
    id: "assetRange",
    prompt: "Roughly, what is the total value of everything you own?",
    help: "Include home equity, savings, retirement accounts and life insurance. A range is fine.",
    options: [
      { value: "under_250k", label: "Under $250,000" },
      { value: "250k_1m", label: "$250,000 to $1 million" },
      { value: "1m_5m", label: "$1 million to $5 million" },
      { value: "over_5m", label: "Over $5 million" },
      { value: "prefer_not", label: "Prefer not to say" },
    ],
  },
  {
    id: "existingDocuments",
    prompt: "Do you already have any estate planning documents?",
    options: [
      { value: "none", label: "No" },
      { value: "will_only", label: "A will" },
      { value: "trust", label: "A trust" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "urgency",
    prompt: "How soon are you looking to get this done?",
    options: [
      { value: "exploring", label: "Just exploring" },
      { value: "this_month", label: "In the next few weeks" },
      { value: "health_event", label: "Soon, because of a health event or upcoming surgery" },
      { value: "recent_death", label: "A family member recently passed away" },
    ],
  },
];

export interface EducationTopic {
  title: string;
  body: string;
}

/** Topics people in a similar situation commonly discuss with an attorney. Educational only. */
export function educationTopics(a: Partial<QuizAnswers>): EducationTopic[] {
  const topics: EducationTopic[] = [];
  if (a.matterType === "after_death") {
    topics.push({
      title: "Probate and trust administration",
      body: "Settling an estate usually involves finding the will or trust, notifying the court and creditors, and transferring assets. Timelines and costs depend on your state and on how assets were titled.",
    });
    return topics;
  }
  topics.push({
    title: "A will",
    body: "A will names who receives your property and who handles your estate. Without one, state law decides.",
  });
  topics.push({
    title: "Financial and healthcare powers of attorney",
    body: "These let someone you trust manage money and make medical decisions if you cannot.",
  });
  if (a.children === "minors" || a.children === "both") {
    topics.push({
      title: "Guardians for minor children",
      body: "Parents of minors commonly name a guardian and decide how money left to children will be managed until they are older.",
    });
  }
  if (a.ownsHome === "yes" || a.outOfStateProperty === "yes" || a.assetRange === "1m_5m" || a.assetRange === "over_5m") {
    topics.push({
      title: "A revocable living trust",
      body: "Homeowners, and especially people with property in more than one state, often ask whether a trust can help their family avoid probate.",
    });
  }
  if (a.specialNeeds === "yes") {
    topics.push({
      title: "A special needs trust",
      body: "Families often use a special needs trust so an inheritance does not affect a loved one's eligibility for benefits.",
    });
  }
  if (a.blendedFamily === "yes") {
    topics.push({
      title: "Planning for a blended family",
      body: "When there are children from earlier relationships, people often want specific provisions so both a spouse and each child are provided for.",
    });
  }
  if (a.ownsBusiness === "yes") {
    topics.push({
      title: "Business succession",
      body: "Business owners commonly plan who takes over or how the business is sold, and coordinate it with their estate plan.",
    });
  }
  if (a.matterType === "elder_care") {
    topics.push({
      title: "Long-term care planning",
      body: "Planning ahead for nursing or home care often involves benefit rules with look-back periods, so timing matters.",
    });
  }
  if (a.assetRange === "over_5m") {
    topics.push({
      title: "Estate tax planning",
      body: "Larger estates may be affected by federal or state estate taxes, depending on current exemption amounts and the state you live in.",
    });
  }
  return topics;
}
