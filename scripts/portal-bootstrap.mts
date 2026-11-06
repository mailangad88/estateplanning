/**
 * Creates the first portal accounts on the live database, so the team can sign in and work leads.
 * Safe to run again: it finds rows by email and updates them instead of adding duplicates.
 *
 *   DATABASE_URL=postgres://... npm run portal:bootstrap -- \
 *     --firm "Sargun Singh, Attorney at Law" \
 *     --attorney "Sargun Singh" --attorney-email sargun@familyfutureplanning.com --attorney-phone "+13125550100" \
 *     --admin "Angad Singh" --admin-email angad@example.com \
 *     [--intake-email sargun+intake@familyfutureplanning.com] [--states IL]
 *
 * Accounts made:
 * - the attorney (role attorney, primary intake: every new lead is offered to them first);
 * - the admin (role platform_admin: sees everything, runs reports and the referral charts);
 * - optional: an intake login for the attorney (role intake), because the intake queue, first calls
 *   and conflict checks happen before a lead is offered to any attorney. Use a plus-address so it
 *   lands in the same inbox. Each login sets up its own two-step code on first sign-in.
 *
 * Without DATABASE_URL it prints what it would write and changes nothing.
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import type { Db } from "@/server/db";
import type { Lawyer, MatterType, User } from "@/server/types";

const { values: a } = parseArgs({
  options: {
    firm: { type: "string" },
    attorney: { type: "string" },
    "attorney-email": { type: "string" },
    "attorney-phone": { type: "string" },
    admin: { type: "string" },
    "admin-email": { type: "string" },
    "intake-email": { type: "string" },
    states: { type: "string", default: "IL" },
  },
});

function need(name: string, v: string | undefined): string {
  if (!v?.trim()) {
    console.error(`Missing --${name}. Run with --firm, --attorney, --attorney-email, --admin and --admin-email.`);
    process.exit(1);
  }
  return v.trim();
}

const firmName = need("firm", a.firm);
const attorneyName = need("attorney", a.attorney);
const attorneyEmail = need("attorney-email", a["attorney-email"]).toLowerCase();
const adminName = need("admin", a.admin);
const adminEmail = need("admin-email", a["admin-email"]).toLowerCase();
const intakeEmail = a["intake-email"]?.trim().toLowerCase();
const states = (a.states ?? "IL").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const MATTERS: MatterType[] = ["new_plan", "update_plan", "administration", "elder_law", "special_needs", "business_succession"];

async function upsertUser(db: Db, u: Omit<User, "id">): Promise<User> {
  const found = (await db.users.list((x) => x.email.toLowerCase() === u.email)).at(0);
  if (found) return await db.users.update(found.id, { ...u });
  return await db.users.insert({ id: randomUUID(), ...u });
}

async function run(db: Db) {
  const lawyerFound = (await db.lawyers.list((l) => l.email.toLowerCase() === attorneyEmail)).at(0);
  const firmId = lawyerFound?.firmId ?? (await db.firms.list((f) => f.name === firmName)).at(0)?.id ?? randomUUID();
  if (!(await db.firms.get(firmId))) await db.firms.insert({ id: firmId, name: firmName, structure: "in_firm" });

  const others = await db.lawyers.list((l) => !!l.primaryIntake && l.email.toLowerCase() !== attorneyEmail);
  for (const o of others) await db.lawyers.update(o.id, { primaryIntake: false });

  const profile: Omit<Lawyer, "id"> = {
    firmId,
    name: attorneyName,
    email: attorneyEmail,
    ...(a["attorney-phone"] ? { phone: a["attorney-phone"] } : {}),
    licensedStates: states,
    matterTypes: MATTERS,
    specialties: [],
    languages: ["en"],
    weeklyCapacity: 15,
    activeLeadCap: 40,
    acceptSlaMinutes: 60,
    primaryIntake: true,
    active: true,
    stats: { avgAcceptMinutes: 0, showRate: 1, reviewScore: 5 },
  };
  const lawyer = lawyerFound ? await db.lawyers.update(lawyerFound.id, profile) : await db.lawyers.insert({ id: randomUUID(), ...profile });

  const made = [
    await upsertUser(db, { email: attorneyEmail, name: attorneyName, role: "attorney", firmId, lawyerId: lawyer.id, active: true }),
    await upsertUser(db, { email: adminEmail, name: adminName, role: "platform_admin", active: true }),
  ];
  if (intakeEmail) made.push(await upsertUser(db, { email: intakeEmail, name: `${attorneyName} (intake)`, role: "intake", active: true }));
  return { firmId, lawyerId: lawyer.id, users: made.map((u) => `${u.role}: ${u.email}`) };
}

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is not set: dry run, nothing written.");
  console.log({ firm: firmName, attorney: { name: attorneyName, email: attorneyEmail, states, primaryIntake: true }, admin: adminEmail, intake: intakeEmail ?? "(none)" });
  process.exit(0);
}

const { createPgDb, getPool } = await import("@/server/pg");
try {
  const result = await run(createPgDb());
  console.log("Done. Each person signs in at /portal with their email, then sets up a two-step code.");
  console.log(result);
} finally {
  await getPool().end();
}
