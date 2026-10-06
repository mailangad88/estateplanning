/**
 * Postgres implementation of Db (db/schema.sql). Every operation runs in its own
 * transaction that first sets the per-request RLS settings and switches to the
 * app_user (or app_service) role, so the database enforces access as the second layer.
 *
 * RLS behaviours the app layer must account for (see db/README.md):
 *  - Offer-stage viewers (lead_access = 'conflict_card') cannot SELECT leads: leads.get returns
 *    undefined. Use leadOfferCard / leadOfferCards (the lead_offer_cards view) for them.
 *  - Writes that the policy rejects throw (SQLSTATE 42501); updates that match no visible row
 *    throw "not found or not permitted".
 *  - insert() does not use RETURNING (some roles may insert rows they cannot read back, e.g.
 *    intake -> documents) and returns the item as given.
 *  - list() has no defined order except audit (by seq).
 */
import { Pool, type PoolClient } from "pg";
import type { AppendOnly, Collection, Db, Where } from "@/server/db";
import type { AutomationState } from "@/server/db";
import type { AuditEvent, ConflictCard, MatterType, Role } from "@/server/types";
import type { ScoreResult } from "@/lib/scoring";
import {
  TABLES,
  columnFor,
  fromRow,
  placeholder,
  quote,
  selectList,
  toParam,
  type TableSpec,
} from "./mapping";

export type PgSession =
  | {
      userId: string;
      role: Role;
      firmId?: string;
      lawyerId?: string;
      personId?: string;
      supportsLawyerIds?: string[];
    }
  | "service";

export interface OfferCard {
  id: string;
  offerSummary: string;
  conflictCard: ConflictCard;
  matterType: MatterType;
  state: string;
  county?: string;
  urgent: boolean;
  score: ScoreResult;
}

export type PgDb = Db & {
  pool: Pool;
  session: PgSession;
  /** A lead as an offer-stage lawyer may see it (lead_offer_cards view); undefined if not visible */
  leadOfferCard(id: string): Promise<OfferCard | undefined>;
  leadOfferCards(): Promise<OfferCard[]>;
  /** The same pool, a different actor */
  withSession(session: PgSession): PgDb;
};

/** Advisory lock key serializing audit appends (hash chain must not fork). */
const AUDIT_LOCK = 7283001;
const POOL_KEY = Symbol.for("estateplanning.pg.pool");

export function getPool(): Pool {
  const g = globalThis as unknown as Record<symbol, Pool | undefined>;
  let pool = g[POOL_KEY];
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString });
    g[POOL_KEY] = pool;
  }
  return pool;
}

async function applySession(client: PoolClient, session: PgSession): Promise<void> {
  const s =
    session === "service"
      ? { userId: "", role: "", firmId: "", lawyerId: "", personId: "", supports: "", dbRole: "app_service" }
      : {
          userId: session.userId,
          role: session.role,
          firmId: session.firmId ?? "",
          lawyerId: session.lawyerId ?? "",
          personId: session.personId ?? "",
          supports: (session.supportsLawyerIds ?? []).join(","),
          dbRole: "app_user",
        };
  await client.query(
    `SELECT set_config('app.user_id',$1,true), set_config('app.role',$2,true), set_config('app.firm_id',$3,true),
            set_config('app.lawyer_id',$4,true), set_config('app.person_id',$5,true),
            set_config('app.supports_lawyer_ids',$6,true), set_config('role',$7,true)`,
    [s.userId, s.role, s.firmId, s.lawyerId, s.personId, s.supports, s.dbRole],
  );
}

export async function inTx<R>(pool: Pool, session: PgSession, fn: (c: PoolClient) => Promise<R>): Promise<R> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await applySession(client, session);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw e;
  } finally {
    client.release(broken ? true : undefined);
  }
}

function buildWhere(spec: TableSpec, where: Where | undefined, params: unknown[]): string {
  if (!where) return "";
  const parts: string[] = [];
  for (const [prop, value] of Object.entries(where)) {
    const c = columnFor(spec, prop);
    if (c.kind === "jsonb" || c.kind === "json" || c.kind === "textarr") {
      throw new Error(`${spec.table}.${prop}: where supports scalar fields only`);
    }
    if (value === null) {
      parts.push(`${quote(c.col)} IS NULL`);
    } else {
      params.push(value);
      parts.push(`${quote(c.col)} = ${placeholder(c, params.length)}`);
    }
  }
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
}

class PgCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    protected pool: Pool,
    protected session: PgSession,
    protected spec: TableSpec,
  ) {}

  async get(id: string): Promise<T | undefined> {
    const rows = await inTx(this.pool, this.session, async (c) =>
      (await c.query(`SELECT ${selectList(this.spec)} FROM ${quote(this.spec.table)} WHERE id = $1`, [id])).rows,
    );
    return rows[0] ? fromRow<T>(this.spec, rows[0]) : undefined;
  }

  async list(filter?: (item: T) => boolean, where?: Where): Promise<T[]> {
    const params: unknown[] = [];
    const clause = buildWhere(this.spec, where, params);
    const rows = await inTx(this.pool, this.session, async (c) =>
      (await c.query(`SELECT ${selectList(this.spec)} FROM ${quote(this.spec.table)}${clause}`, params)).rows,
    );
    const items = rows.map((r) => fromRow<T>(this.spec, r));
    return filter ? items.filter(filter) : items;
  }

  async insert(item: T): Promise<T> {
    const cols: string[] = [];
    const holders: string[] = [];
    const params: unknown[] = [];
    for (const key of Object.keys(item)) {
      const c = columnFor(this.spec, key); // throws on unknown fields rather than dropping them
      const v = (item as Record<string, unknown>)[key];
      if (v === undefined) continue;
      params.push(toParam(c, v));
      cols.push(quote(c.col));
      holders.push(placeholder(c, params.length));
    }
    await inTx(this.pool, this.session, (c) =>
      c.query(`INSERT INTO ${quote(this.spec.table)} (${cols.join(", ")}) VALUES (${holders.join(", ")})`, params),
    );
    return structuredClone(item);
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const key of Object.keys(patch)) {
      if (key === "id") continue;
      const c = columnFor(this.spec, key);
      const v = (patch as Record<string, unknown>)[key];
      if (v === undefined && !c.nullable) continue;
      params.push(toParam(c, v));
      sets.push(`${quote(c.col)} = ${placeholder(c, params.length)}`);
    }
    if (sets.length === 0) {
      const existing = await this.get(id);
      if (!existing) throw new Error(`not found: ${id}`);
      return existing;
    }
    const rows = await inTx(this.pool, this.session, async (c) =>
      (
        await c.query(
          `UPDATE ${quote(this.spec.table)} SET ${sets.join(", ")} WHERE id = $1 RETURNING ${selectList(this.spec)}`,
          params,
        )
      ).rows,
    );
    if (!rows[0]) throw new Error(`not found or not permitted: ${id}`);
    return fromRow<T>(this.spec, rows[0]);
  }
}

class PgAudit implements AppendOnly<AuditEvent> {
  private spec = TABLES.audit;
  constructor(
    private pool: Pool,
    private session: PgSession,
  ) {}

  /** Only service and platform_admin may read audit rows (RLS); others get []. */
  async list(filter?: (item: AuditEvent) => boolean, where?: Where): Promise<AuditEvent[]> {
    const params: unknown[] = [];
    const clause = buildWhere(this.spec, where, params);
    const rows = await inTx(this.pool, this.session, async (c) =>
      (await c.query(`SELECT ${selectList(this.spec)} FROM audit_events${clause} ORDER BY seq`, params)).rows,
    );
    const items = rows.map((r) => fromRow<AuditEvent>(this.spec, r));
    return filter ? items.filter(filter) : items;
  }

  private async readLast(c: PoolClient): Promise<AuditEvent | undefined> {
    const canRead = this.session === "service" || this.session.role === "platform_admin";
    if (canRead) {
      const r = await c.query(`SELECT ${selectList(this.spec)} FROM audit_events ORDER BY seq DESC LIMIT 1`);
      return r.rows[0] ? fromRow<AuditEvent>(this.spec, r.rows[0]) : undefined;
    }
    // Other roles may only see the chain tip (seq, hash) through the SECURITY DEFINER helper.
    const r = await c.query("SELECT seq, hash FROM audit_last()");
    return r.rows[0] ? ({ seq: Number(r.rows[0].seq), hash: r.rows[0].hash } as AuditEvent) : undefined;
  }

  async last(): Promise<AuditEvent | undefined> {
    return inTx(this.pool, this.session, (c) => this.readLast(c));
  }

  async appendWith(build: (last: AuditEvent | undefined) => AuditEvent | Promise<AuditEvent>): Promise<AuditEvent> {
    return inTx(this.pool, this.session, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock($1)", [AUDIT_LOCK]);
      const last = await this.readLast(c);
      const item = await build(last);
      const cols: string[] = [];
      const holders: string[] = [];
      const params: unknown[] = [];
      for (const key of Object.keys(item)) {
        const col = columnFor(this.spec, key);
        const v = (item as unknown as Record<string, unknown>)[key];
        if (v === undefined) continue;
        params.push(toParam(col, v));
        cols.push(quote(col.col));
        holders.push(placeholder(col, params.length));
      }
      await c.query(`INSERT INTO audit_events (${cols.join(", ")}) VALUES (${holders.join(", ")})`, params);
      return structuredClone(item);
    });
  }
}

export function createPgDb(opts: { pool?: Pool; session?: PgSession } = {}): PgDb {
  const pool = opts.pool ?? getPool();
  const session: PgSession = opts.session ?? "service";
  const col = <T extends { id: string }>(spec: TableSpec) => new PgCollection<T>(pool, session, spec);
  const db = {
    users: col(TABLES.users),
    firms: col(TABLES.firms),
    lawyers: col(TABLES.lawyers),
    persons: col(TABLES.persons),
    leads: col(TABLES.leads),
    assignments: col(TABLES.assignments),
    documents: col(TABLES.documents),
    comments: col(TABLES.comments),
    activities: col(TABLES.activities),
    consults: col(TABLES.consults),
    engagements: col(TABLES.engagements),
    tasks: col(TABLES.tasks),
    feeRuleVersions: col(TABLES.feeRuleVersions),
    billableEvents: col(TABLES.billableEvents),
    invoices: col(TABLES.invoices),
    enrollments: col(TABLES.enrollments),
    suppressions: col(TABLES.suppressions),
    automationState: col<AutomationState>(TABLES.automationState),
    crmDeliveries: col(TABLES.crmDeliveries),
    audit: new PgAudit(pool, session),
    pool,
    session,
    async leadOfferCards() {
      const rows = await inTx(pool, session, async (c) => (await c.query("SELECT * FROM lead_offer_cards")).rows);
      return rows.map(toOfferCard);
    },
    async leadOfferCard(id: string) {
      const rows = await inTx(pool, session, async (c) =>
        (await c.query("SELECT * FROM lead_offer_cards WHERE id = $1", [id])).rows,
      );
      return rows[0] ? toOfferCard(rows[0]) : undefined;
    },
    withSession(next: PgSession) {
      return createPgDb({ pool, session: next });
    },
  } satisfies PgDb;
  return db;
}

function toOfferCard(r: Record<string, unknown>): OfferCard {
  return {
    id: r.id as string,
    offerSummary: r.offer_summary as string,
    conflictCard: r.conflict_card as ConflictCard,
    matterType: r.matter_type as MatterType,
    state: r.state as string,
    ...(r.county != null ? { county: r.county as string } : {}),
    urgent: r.urgent as boolean,
    score: r.score as ScoreResult,
  };
}

export function withPgSession(db: PgDb, session: PgSession): PgDb {
  return db.withSession(session);
}

export async function leadOfferCard(db: PgDb, id: string): Promise<OfferCard | undefined> {
  return db.leadOfferCard(id);
}
