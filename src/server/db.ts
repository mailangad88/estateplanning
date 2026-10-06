/**
 * Storage layer. Every service takes a `Db` so the in-memory store used in tests
 * and local development can be swapped for the Postgres store (db/schema.sql)
 * without touching business logic. Access control is enforced twice in production:
 * by the policy functions in src/server/auth/policy.ts and by row-level security.
 */
import type {
  Seminar,
  Activity,
  Assignment,
  AuditEvent,
  Comment,
  Consult,
  CrmDelivery,
  DocumentRecord,
  Engagement,
  Firm,
  Lawyer,
  Lead,
  Partner,
  PartnerGift,
  PartnerReferral,
  PaymentRecord,
  Person,
  Task,
  User,
} from "@/server/types";
import type { FeeRuleVersion, Invoice } from "@/server/fees/admin";
import type { BillableEvent } from "@/lib/fees";
import type { FactVerification } from "@/lib/facts";
import type { SequenceEnrollment, Suppression } from "@/server/nurture/types";

export type Where = Record<string, string | number | boolean | null>;

export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  /** `where` is an equality filter on top-level fields (pushed down to SQL); `filter` runs in JS after it. */
  list(filter?: (item: T) => boolean, where?: Where): Promise<T[]>;
  insert(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
}

/** Audit events are append-only: the collection has no update method. */
export interface AppendOnly<T extends { id: string }> {
  list(filter?: (item: T) => boolean, where?: Where): Promise<T[]>;
  /** Appends atomically: `build` receives the current last item and returns the new one. Stores must serialize concurrent calls (Postgres uses an advisory lock) so a hash chain never forks. */
  appendWith(build: (last: T | undefined) => T | Promise<T>): Promise<T>;
  last(): Promise<T | undefined>;
}

function matches(item: object, where?: Where): boolean {
  if (!where) return true;
  const rec = item as Record<string, unknown>;
  return Object.entries(where).every(([k, v]) => (rec[k] ?? null) === v);
}

export class MemoryCollection<T extends { id: string }> implements Collection<T> {
  private items = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    const item = this.items.get(id);
    return item ? structuredClone(item) : undefined;
  }

  async list(filter?: (item: T) => boolean, where?: Where): Promise<T[]> {
    const all = [...this.items.values()].filter((i) => matches(i, where)).map((i) => structuredClone(i));
    return filter ? all.filter(filter) : all;
  }

  async insert(item: T): Promise<T> {
    if (this.items.has(item.id)) throw new Error(`duplicate id ${item.id}`);
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = this.items.get(id);
    if (!existing) throw new Error(`not found: ${id}`);
    const next = { ...existing, ...structuredClone(patch), id };
    this.items.set(id, next);
    return structuredClone(next);
  }
}

export class MemoryAppendOnly<T extends { id: string }> implements AppendOnly<T> {
  private items: T[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  async list(filter?: (item: T) => boolean, where?: Where): Promise<T[]> {
    const all = this.items.filter((i) => matches(i, where)).map((i) => structuredClone(i));
    return filter ? all.filter(filter) : all;
  }

  appendWith(build: (last: T | undefined) => T | Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const last = this.items[this.items.length - 1];
      const item = await build(last ? structuredClone(last) : undefined);
      this.items.push(structuredClone(item));
      return structuredClone(item);
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }

  async last(): Promise<T | undefined> {
    const item = this.items[this.items.length - 1];
    return item ? structuredClone(item) : undefined;
  }
}

export interface Db {
  users: Collection<User>;
  firms: Collection<Firm>;
  lawyers: Collection<Lawyer>;
  persons: Collection<Person>;
  leads: Collection<Lead>;
  assignments: Collection<Assignment>;
  documents: Collection<DocumentRecord>;
  comments: Collection<Comment>;
  activities: Collection<Activity>;
  consults: Collection<Consult>;
  engagements: Collection<Engagement>;
  payments: Collection<PaymentRecord>;
  tasks: Collection<Task>;
  feeRuleVersions: Collection<FeeRuleVersion>;
  billableEvents: Collection<BillableEvent>;
  invoices: Collection<Invoice>;
  enrollments: Collection<SequenceEnrollment>;
  suppressions: Collection<Suppression>;
  factVerifications: Collection<FactVerification>;
  automationState: Collection<AutomationState>;
  crmDeliveries: Collection<CrmDelivery>;
  seminars: Collection<Seminar>;
  partners: Collection<Partner>;
  partnerGifts: Collection<PartnerGift>;
  partnerReferrals: Collection<PartnerReferral>;
  audit: AppendOnly<AuditEvent>;
}

/** Cursor into the audit log for the automation runner, plus the last stage it acted on per lead. */
export interface AutomationState {
  id: "automation";
  cursorSeq: number;
  stages: Record<string, string>;
  exits: Record<string, string>;
}

export function createMemoryDb(): Db {
  return {
    users: new MemoryCollection(),
    firms: new MemoryCollection(),
    lawyers: new MemoryCollection(),
    persons: new MemoryCollection(),
    leads: new MemoryCollection(),
    assignments: new MemoryCollection(),
    documents: new MemoryCollection(),
    comments: new MemoryCollection(),
    activities: new MemoryCollection(),
    consults: new MemoryCollection(),
    engagements: new MemoryCollection(),
    payments: new MemoryCollection(),
    tasks: new MemoryCollection(),
    feeRuleVersions: new MemoryCollection(),
    billableEvents: new MemoryCollection(),
    invoices: new MemoryCollection(),
    enrollments: new MemoryCollection(),
    suppressions: new MemoryCollection(),
    factVerifications: new MemoryCollection(),
    automationState: new MemoryCollection(),
    crmDeliveries: new MemoryCollection(),
    seminars: new MemoryCollection(),
    partners: new MemoryCollection(),
    partnerGifts: new MemoryCollection(),
    partnerReferrals: new MemoryCollection(),
    audit: new MemoryAppendOnly(),
  };
}
