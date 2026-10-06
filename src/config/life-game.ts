/**
 * The life game: a board the visitor moves along, one square at a time. Life moments set the scene,
 * "what if" squares ask them to plan for something or put it off, and the finish square shows the
 * plan they built and how to make it real. Scenario wording lives in what-if-scenarios.ts.
 *
 * Boards are plain data so the server can resolve them and hand the client a small, serialisable list.
 */
import { LIFE_STAGES, lifeStageFor } from "./life-stages";
import { PLAN_DOCS, whatIfFor, type PlanDocKey } from "./what-if-scenarios";

export type SquareKind = "start" | "moment" | "whatif" | "finish";

/** A life moment square: sets the scene between "what if" squares. */
interface Moment { title: string; text: string; icon: string }

interface BoardDef {
  start: { title: string; text: string };
  /** Squares in order: a moment, or a scenario id from what-if-scenarios.ts. */
  path: (Moment | string)[];
}

const STAGE_BOARDS: Record<string, BoardDef> = {
  "newlyweds-and-young-couples": {
    start: { title: "You found your person", text: "You are building a life together. Let's walk the next few years and see what could catch you off guard." },
    path: [
      { title: "You say yes", text: "A wedding, a move, a shared lease. Your lives are joined. On paper, most of it still is not.", icon: "Heart" },
      "hospital-wont-talk",
      "unmarried-partner-left-out",
      { title: "You merge your money", text: "A joint account, a 401(k) at the new job, a life insurance policy through work.", icon: "PiggyBank" },
      "ex-still-beneficiary",
      "die-without-a-will",
    ],
  },
  "new-parents": {
    start: { title: "A baby is on the way", text: "Everything changes, including who depends on you. Let's walk the first years as a family." },
    path: [
      { title: "The baby arrives", text: "Sleepless nights, a new car seat, and a little person who needs you for everything.", icon: "Baby" },
      "no-guardian-named",
      "money-to-an-18-year-old",
      { title: "You get life insurance", text: "A policy through work, maybe one more on top. You fill in the beneficiary form in a hurry.", icon: "ShieldCheck" },
      "incapacity-no-poa",
      "special-needs-benefits-lost",
    ],
  },
  "homeowners-and-growing-families": {
    start: { title: "You have a home and a full house", text: "A mortgage, school runs and a family that counts on you. Let's see what could go sideways." },
    path: [
      { title: "You buy the house", text: "It is the biggest thing you own, and it is titled in your names.", icon: "House" },
      "house-stuck-in-probate",
      "no-guardian-named",
      { title: "The years fly by", text: "The kids grow, you change jobs, and the documents you signed are still in a drawer.", icon: "CalendarCheck" },
      "out-of-date-plan",
      "digital-accounts-locked",
    ],
  },
  "blended-families": {
    start: { title: "Two families become one", text: "Yours, mine and maybe ours. Let's walk through the moments where good intentions can go wrong." },
    path: [
      { title: "You marry again", text: "A new spouse, children from before, and an ex who is still on some of the paperwork.", icon: "Users" },
      "stepchildren-left-out",
      "ex-still-beneficiary",
      { title: "You share a home", text: "You move into one house. The question of who gets it later has not come up yet.", icon: "House" },
      "new-spouse-takes-all",
      "family-dispute",
    ],
  },
  "pre-retirees": {
    start: { title: "Retirement is in sight", text: "Your savings are at their biggest and your kids are grown. Let's walk the next stretch." },
    path: [
      { title: "The kids leave home", text: "The guardian you named is no longer needed. The rest of the plan is a decade old.", icon: "Users" },
      "out-of-date-plan",
      "dementia-diagnosis",
      { title: "You count up what you've built", text: "Retirement accounts, a paid-down home, maybe a business. More to protect, more to pass on.", icon: "PiggyBank" },
      "long-term-care-costs",
      "probate-delay",
    ],
  },
  "retirees-and-snowbirds": {
    start: { title: "You've retired", text: "More time for family, travel and maybe a second home. Let's walk the years ahead." },
    path: [
      { title: "Winters somewhere warm", text: "You split the year between two homes, and maybe two states.", icon: "Sun" },
      "property-in-two-states",
      "joint-account-surprise",
      { title: "Health comes first", text: "More doctor visits, more forms, and family who want to help.", icon: "Stethoscope" },
      "end-of-life-wishes-unknown",
      "long-term-care-costs",
    ],
  },
  caregivers: {
    start: { title: "Your parent needs more help", text: "You're driving to appointments and sorting their mail. Let's see what could make it harder." },
    path: [
      { title: "You start helping", text: "A fall, a new diagnosis, or bills that are slipping. You step in.", icon: "HandHeart" },
      "parent-incapacity-caregiver",
      "caregiver-cant-access-records",
      { title: "You take over the bills", text: "You need their bank, their doctors and their accounts to work with you.", icon: "Landmark" },
      "long-term-care-costs",
      "family-dispute",
    ],
  },
};

/** The homepage board: one "what if" per life stage, from a new couple to caring for a parent. */
const LIFE_BOARD_STOPS: Record<string, { id: string; short: string }> = {
  "newlyweds-and-young-couples": { id: "hospital-wont-talk", short: "Newlyweds" },
  "new-parents": { id: "no-guardian-named", short: "New baby" },
  "homeowners-and-growing-families": { id: "house-stuck-in-probate", short: "First home" },
  "blended-families": { id: "ex-still-beneficiary", short: "Remarried" },
  "pre-retirees": { id: "dementia-diagnosis", short: "Pre-retired" },
  "retirees-and-snowbirds": { id: "long-term-care-costs", short: "Retired" },
  caregivers: { id: "parent-incapacity-caregiver", short: "Caregiver" },
};

/** Boards for the main service pages, built from the scenarios each document prevents. */
const SERVICE_BOARDS: Record<string, BoardDef> = {
  wills: {
    start: { title: "You mean to write a will", text: "It is on the list. Let's see what happens to the people you love while it waits." },
    path: ["die-without-a-will", "no-guardian-named", "executor-burden", "documents-cant-be-found", "family-dispute"],
  },
  "living-trusts": {
    start: { title: "You own a home and some savings", text: "A trust sounds like something for other people. Let's walk through what it does." },
    path: ["probate-delay", "house-stuck-in-probate", "property-in-two-states", "new-spouse-takes-all", "joint-account-surprise"],
  },
  "power-of-attorney": {
    start: { title: "You're healthy and in charge", text: "Most people sign a power of attorney after they need one. Let's see why that is too late." },
    path: ["incapacity-no-poa", "dementia-diagnosis", "parent-incapacity-caregiver", "digital-accounts-locked"],
  },
  "healthcare-directives": {
    start: { title: "You're healthy today", text: "Medical decisions come up suddenly. Let's see who would make them for you." },
    path: ["hospital-wont-talk", "end-of-life-wishes-unknown", "caregiver-cant-access-records", "dementia-diagnosis"],
  },
  parents: {
    start: { title: "You're raising kids", text: "They depend on you for everything. Let's see what happens if you can't be there." },
    path: ["no-guardian-named", "money-to-an-18-year-old", "special-needs-benefits-lost", "incapacity-no-poa", "die-without-a-will"],
  },
};

export interface ResolvedDoc { key: PlanDocKey; label: string; icon: string; href: string }

export interface ResolvedSquare {
  kind: SquareKind;
  id: string;
  /** Short label on the board tile. */
  label: string;
  title: string;
  text: string;
  icon: string;
  /** Picture for the card, a name in /media/illustrations. */
  art?: string;
  /** "What if" squares only. */
  delay?: string;
  without?: string;
  withPlan?: string;
  docs?: ResolvedDoc[];
  /** Homepage board: the life stage this square stands for. */
  stage?: { label: string; href: string };
}

const doc = (key: PlanDocKey): ResolvedDoc => ({ key, ...PLAN_DOCS[key] });

function scenarioSquare(id: string, label?: string): ResolvedSquare {
  const s = whatIfFor(id);
  if (!s) throw new Error(`life-game: unknown what-if scenario "${id}"`);
  return {
    kind: "whatif",
    id: s.id,
    label: label ?? "What if?",
    title: s.title,
    text: s.delay,
    icon: PLAN_DOCS[s.fix[0]].icon,
    art: s.art,
    delay: s.delay,
    without: s.without,
    withPlan: s.withPlan,
    docs: s.fix.map(doc),
  };
}

function resolve(def: BoardDef, art: string): ResolvedSquare[] {
  const squares: ResolvedSquare[] = [{ kind: "start", id: "start", label: "Start", title: def.start.title, text: def.start.text, icon: "Flag", art }];
  def.path.forEach((p, i) => {
    squares.push(typeof p === "string" ? scenarioSquare(p) : { kind: "moment", id: `moment-${i}`, label: "Life", title: p.title, text: p.text, icon: p.icon });
  });
  squares.push({ kind: "finish", id: "finish", label: "Your plan", title: "Your plan", text: "", icon: "Trophy" });
  return squares;
}

const STAGE_ART: Record<string, string> = {
  newlyweds: "HeroNewlyweds",
  guardianship: "HeroGuardianship",
  familyHome: "HeroFamilyHome",
  blendedFamily: "HeroBlendedFamily",
  preRetirees: "HeroPreRetirees",
  retirees: "HeroRetirees",
  agingParents: "HeroAgingParents",
};

export function stageBoard(slug: string): ResolvedSquare[] | null {
  const def = STAGE_BOARDS[slug];
  const stage = lifeStageFor(slug);
  if (!def || !stage) return null;
  return resolve(def, STAGE_ART[stage.illustration]);
}

export function serviceBoard(key: keyof typeof SERVICE_BOARDS, art: string): ResolvedSquare[] {
  return resolve(SERVICE_BOARDS[key], art);
}

export function lifeBoard(): ResolvedSquare[] {
  const squares: ResolvedSquare[] = [
    { kind: "start", id: "start", label: "Start", title: "Your whole life, one square at a time", text: "Every stage of life brings one thing that can go wrong when a plan waits. Move along the board and decide: plan for it, or put it off?", icon: "Flag", art: "HeroFamilyHome" },
  ];
  for (const stage of LIFE_STAGES) {
    const stop = LIFE_BOARD_STOPS[stage.slug];
    if (stop) squares.push({ ...scenarioSquare(stop.id, stop.short), stage: { label: stage.label, href: `/estate-planning-for/${stage.slug}` } });
  }
  squares.push({ kind: "finish", id: "finish", label: "Your plan", title: "Your plan", text: "", icon: "Trophy" });
  return squares;
}

export const SERVICE_BOARD_KEYS = Object.keys(SERVICE_BOARDS) as (keyof typeof SERVICE_BOARDS)[];

const SERVICE_PATHS: Record<string, { key: keyof typeof SERVICE_BOARDS; art: string }> = {
  "/wills": { key: "wills", art: "HeroWills" },
  "/living-trusts": { key: "living-trusts", art: "HeroTrusts" },
  "/power-of-attorney": { key: "power-of-attorney", art: "HeroPowersOfAttorney" },
  "/healthcare-directives": { key: "healthcare-directives", art: "HeroPowersOfAttorney" },
  "/estate-planning-for-parents": { key: "parents", art: "HeroGuardianship" },
};

/** The board for a service page, by its path, or null when the page has none. */
export function serviceBoardFor(path: string): ResolvedSquare[] | null {
  const hit = SERVICE_PATHS[path];
  return hit ? serviceBoard(hit.key, hit.art) : null;
}
