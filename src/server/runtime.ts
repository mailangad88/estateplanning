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

const g = globalThis as unknown as { __epDb?: Db };

export function getDb(): Db {
  if (!g.__epDb) {
    if (process.env.NODE_ENV === "production" && process.env.PORTAL_ALLOW_MEMORY_STORE !== "true") {
      throw new Error("The in-memory store is for development. Configure the Postgres store before running the portal in production.");
    }
    const db = createMemoryDb();
    if (process.env.PORTAL_SEED_DEMO !== "false") seedDemo(db);
    g.__epDb = db;
  }
  return g.__epDb;
}

/** The signed-in actor for a server component or route handler, or null. */
export async function currentActor(): Promise<Actor | null> {
  const jar = await cookies();
  return actorFromSession(getDb(), jar.get(SESSION_COOKIE)?.value);
}
