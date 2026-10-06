/**
 * Self-reported lead source ("How did you hear about us?"). Optional on every consult form.
 * Many visitors who found the firm through an AI assistant arrive as direct or branded search
 * traffic, so asking is the only reliable way to count them (aeo-geo-playbook.md, measurement).
 */
export const HEARD_FROM_OPTIONS = [
  { value: "google_search", label: "Google or another search engine" },
  { value: "ai_assistant", label: "ChatGPT or another AI assistant" },
  { value: "social_media", label: "Social media" },
  { value: "friend_family", label: "Friend or family" },
  { value: "advisor_cpa", label: "Financial advisor or CPA" },
  { value: "other", label: "Other" },
] as const;

export type HeardFrom = (typeof HEARD_FROM_OPTIONS)[number]["value"];

export const HEARD_FROM_VALUES = HEARD_FROM_OPTIONS.map((o) => o.value) as [HeardFrom, ...HeardFrom[]];
