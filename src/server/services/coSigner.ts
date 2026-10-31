/**
 * Joint representation: the second client (a spouse or partner) signs from their own client login, never from
 * the first client's session. The lawyer enters the spouse's email when sending, or the first client gives it
 * on the signing page; either way the spouse gets their own single-use invite, signs in through the same
 * preauth and two-step flow, and can sign only the spouse slot (signEngagement and the
 * engagement_signature_signer_guard trigger bind each signature to the signer's own person and user).
 *
 * A first client who asks for the invite never sees the link itself: holding it would let them sign in as
 * the spouse. Staff see it, so they can text it when email is in dry-run mode.
 */
import { randomUUID } from "node:crypto";
import { firstNameOf, maskEmail } from "@/lib/people";
import { audit } from "@/server/audit/log";
import { assertCan, ForbiddenError, leadAccess } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { signingPath } from "@/server/esign/builtin";
import { emailTransportFromEnv, type EmailTransport } from "@/server/notify/transports";
import { INVITE_TTL_MS, signInvite } from "@/server/services/clientPortal";
import { getEngagement, leadFor, systemNote } from "@/server/services/engagementShared";
import type { Actor, Engagement, Lead, Person, User } from "@/server/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export { firstNameOf, maskEmail };

/** Who the actor is on this engagement: the lead's client, the second client, or neither. */
export function signerSlotOf(actor: Actor, lead: Lead, e: Engagement): "client" | "spouse" | undefined {
  if (actor.role !== "client" || !actor.personId) return undefined;
  if (actor.personId === lead.personId) return "client";
  if (e.spouseName && e.spousePersonId && actor.personId === e.spousePersonId) return "spouse";
  return undefined;
}

/**
 * Records the second client's email on their own person record (created on first use) and ties it to the
 * engagement. Refuses the first client's email: each spouse signs from their own account.
 */
/**
 * Checks a second client's email without writing anything; returns it normalised and the person that already
 * owns it, if any. Used before a draft is saved and again when the address is recorded.
 */
export async function checkSpouseEmail(db: Db, lead: Lead, spouseName: string, rawEmail: string, spousePersonId?: string): Promise<{ email: string; personId?: string }> {
  const spouseFirst = firstNameOf(spouseName);
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) throw new Error(`Enter a valid email address for ${spouseFirst}.`);
  const client = await db.persons.get(lead.personId);
  if (client && client.email.trim().toLowerCase() === email) {
    throw new Error(`${spouseFirst} needs their own email address, so each of you signs from your own account.`);
  }
  const owner = (await db.users.list((u) => u.email.trim().toLowerCase() === email))[0];
  if (!owner) return { email, personId: spousePersonId };
  // The address already has a login: usable only if it is a client login that is not the first client's
  // and, when a second client is already on file, is that same person.
  const usable = owner.role === "client" && !!owner.personId && owner.personId !== lead.personId && (!spousePersonId || owner.personId === spousePersonId);
  if (!usable) throw new Error(`That email is already used by another account. Use a different email for ${spouseFirst}.`);
  return { email, personId: owner.personId };
}

export async function setSpouseSigner(db: Db, lead: Lead, e: Engagement, rawEmail: string): Promise<{ engagement: Engagement; person: Person }> {
  if (!e.spouseName) throw new Error("This agreement has no second client.");
  if ((await db.signatures.list(undefined, { engagementId: e.id })).some((s) => s.signerRole === "spouse")) {
    throw new Error(`${firstNameOf(e.spouseName)} has already signed.`);
  }
  const { email, personId } = await checkSpouseEmail(db, lead, e.spouseName, rawEmail, e.spousePersonId);
  const client = await db.persons.get(lead.personId);

  let person: Person | undefined = personId ? await db.persons.get(personId) : undefined;
  if (person) {
    if (person.email.trim().toLowerCase() !== email) {
      person = await db.persons.update(person.id, { email });
      const login = (await db.users.list((u) => u.role === "client" && u.personId === person!.id))[0];
      if (login) await db.users.update(login.id, { email });
    }
  } else {
    const [first, ...rest] = e.spouseName.trim().split(/\s+/);
    person = await db.persons.insert({
      id: randomUUID(),
      firstName: first,
      lastName: rest.join(" ") || (client?.lastName ?? ""),
      email,
      phone: "",
      language: client?.language ?? "en",
      state: lead.state,
      county: lead.county,
      householdId: client?.householdId,
    });
  }
  const engagement = e.spousePersonId === person.id ? e : await db.engagements.update(e.id, { spousePersonId: person.id });
  return { engagement, person };
}

async function clientLoginFor(db: Db, lead: Lead, person: Person): Promise<User> {
  let user = (await db.users.list((u) => u.role === "client" && u.personId === person.id))[0];
  if (!user) {
    user = await db.users.insert({
      id: randomUUID(),
      email: person.email.trim().toLowerCase(),
      name: `${person.firstName} ${person.lastName}`.trim(),
      role: "client",
      firmId: lead.firmId,
      personId: person.id,
      active: true,
    });
  } else if (!user.active) {
    user = await db.users.update(user.id, { active: true });
  }
  return user;
}

export interface SpouseInvite {
  name: string;
  firstName: string;
  emailHint: string;
  /** False when the email went to the log only (OUTBOUND_SEND_MODE is not live) */
  delivered: boolean;
  /** The single-use link: returned to staff only, never to the first client */
  link?: string;
}

/**
 * Sends the second client their own single-use invite to the signing page. Staff on the case (or the first
 * client, from the signing page) may ask for it; giving `email` records or corrects the address first.
 */
export async function inviteSpouse(
  db: Db,
  actor: Actor,
  engagementId: string,
  email: string | undefined,
  opts: { email?: EmailTransport; notify?: boolean } = {},
  now = new Date(),
): Promise<SpouseInvite> {
  let e = await getEngagement(db, engagementId);
  const lead = await leadFor(db, e);
  const access = leadAccess(actor, lead, await db.assignments.list(undefined, { leadId: lead.id }), now);
  const staff = access === "full" && ["attorney", "paralegal", "firm_admin", "platform_admin"].includes(actor.role);
  const firstClient = signerSlotOf(actor, lead, e) === "client";
  assertCan(staff || firstClient, "Only the office or the first client can send this invite");
  if (!e.spouseName) throw new Error("This agreement has no second client.");
  if (e.provider !== "builtin") throw new ForbiddenError("This agreement is signed through another service.");
  if (!["approved", "sent", "viewed"].includes(e.status)) throw new Error(e.status === "voided" ? "This agreement was withdrawn." : "This agreement is already signed.");

  if (email) e = (await setSpouseSigner(db, lead, e, email)).engagement;
  const spouseFirst = firstNameOf(e.spouseName!);
  if (!e.spousePersonId) throw new Error(`Add ${spouseFirst}'s email address first.`);
  const person = await db.persons.get(e.spousePersonId);
  if (!person) throw new Error("Second client record not found");
  const user = await clientLoginFor(db, lead, person);

  const token = signInvite({ uid: user.id, lid: lead.id, jti: randomUUID(), exp: now.getTime() + INVITE_TTL_MS });
  const link = `/client/welcome?token=${encodeURIComponent(token)}&next=${encodeURIComponent(signingPath(e.id))}`;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const transport = opts.email ?? emailTransportFromEnv();
  const sent = await transport.send({
    to: person.email,
    subject: "Your engagement agreement is ready to review and sign",
    text: `Hello ${person.firstName},\n\nYour attorney's office has sent the engagement agreement for you to review and sign. You sign from your own link, in about five minutes.\n\nOpen it here: ${base}${link}\n\nThis link is just for you, works once and expires in 7 days. If it has expired, reply to this email or call the office for a new one.`,
    stream: "transactional",
    tag: "engagement-signing-invite",
  });
  const at = now.toISOString();
  await systemNote(db, lead.id, sent.dryRun ? "Signing link prepared for the second client (email dry run: not sent)" : "Signing link emailed to the second client", at, actor.userId);
  await audit(db, actor, {
    action: "engagement.cosigner_invite",
    resourceType: "engagement",
    resourceId: e.id,
    leadId: lead.id,
    detail: { userId: user.id, requestedBy: staff ? "office" : "client", dryRun: sent.dryRun },
    at: now,
  });
  return {
    name: e.spouseName!,
    firstName: spouseFirst,
    emailHint: maskEmail(person.email),
    delivered: !sent.dryRun,
    ...(staff ? { link } : {}),
  };
}
