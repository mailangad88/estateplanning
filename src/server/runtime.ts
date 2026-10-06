/**
 * Process-wide singletons for API routes and pages. Development uses the
 * in-memory store with demo data; production must use the Postgres store
 * (db/schema.sql), so the memory store refuses to start there unless explicitly
 * allowed for a staging demo.
 */
import { cookies } from "next/headers";
import { actorFromSession, SESSION_COOKIE } from "@/server/auth/session";
import { createMemoryDb, type Db } from "@/server/db";
import { seedDemo } from "@/server/seed";
import type { Actor } from "@/server/types";

const g = globalThis as unknown as { __epDb?: Promise<Db> };

async function createDb(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { createPgDb } = await import("@/server/pg");
    const { PgMfaStore } = await import("@/server/pg/mfa");
    const { configureAuth } = await import("@/server/auth/flow");
    configureAuth({ mfa: new PgMfaStore() });
    return createPgDb();
  }
  if (process.env.NODE_ENV === "production" && process.env.PORTAL_ALLOW_MEMORY_STORE !== "true") {
    throw new Error("The in-memory store is for development. Configure DATABASE_URL (Postgres) before running the portal in production.");
  }
  const db = createMemoryDb();
  if (process.env.PORTAL_SEED_DEMO !== "false") await seedDemo(db);
  return db;
}

export async function getDb(): Promise<Db> {
  if (!g.__epDb) {
    g.__epDb = createDb().catch((err) => {
      g.__epDb = undefined; // let the next request retry
      throw err;
    });
  }
  return g.__epDb;
}

/**
 * The store as seen by one signed-in user. With Postgres this binds the request to
 * the user's row-level security session, so the database enforces the same rules as
 * policy.ts; the memory store has no second layer and is returned as is.
 */
export function scopedDb(db: Db, actor: Actor): Db {
  const pg = db as Db & { withSession?: (s: unknown) => Db };
  if (!pg.withSession) return db;
  return pg.withSession({
    userId: actor.userId,
    role: actor.role,
    firmId: actor.firmId,
    lawyerId: actor.lawyerId,
    personId: actor.personId,
    supportsLawyerIds: actor.supportsLawyerIds,
  });
}

/** The signed-in actor for a server component or route handler, or null. */
export async function currentActor(): Promise<Actor | null> {
  const jar = await cookies();
  return await actorFromSession(await getDb(), jar.get(SESSION_COOKIE)?.value);
}

/** Signed-in actor plus the store scoped to them, for server components. */
export async function currentSession(): Promise<{ actor: Actor; db: Db } | null> {
  const actor = await currentActor();
  return actor ? { actor, db: scopedDb(await getDb(), actor) } : null;
}
