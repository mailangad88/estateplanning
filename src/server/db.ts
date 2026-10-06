/**
 * Storage layer. Every service takes a `Db` so the in-memory store used in tests
 * and local development can be swapped for the Postgres store (db/schema.sql)
 * without touching business logic. Access control is enforced twice in production:
 * by the policy functions in src/server/auth/policy.ts and by row-level security.
 */
import type {
  Activity,
  Assignment,
  AuditEvent,
  Comment,
  Consult,
  DocumentRecord,
  Engagement,
  Firm,
  Lawyer,
  Lead,
  Person,
  Task,
  User,
} from "@/server/types";
import type { FeeRuleVersion, Invoice } from "@/server/fees/admin";
import type { BillableEvent } from "@/lib/fees";
import type { SequenceEnrollment, Suppression } from "@/server/nurture/types";

export interface Collection<T extends { id: string }> {
  get(id: string): T | undefined;
  list(filter?: (item: T) => boolean): T[];
  insert(item: T): T;
  update(id: string, patch: Partial<T>): T;
}

export class MemoryCollection<T extends { id: string }> implements Collection<T> {
  private items = new Map<string, T>();

  get(id: string): T | undefined {
    const item = this.items.get(id);
    return item ? structuredClone(item) : undefined;
  }

  list(filter?: (item: T) => boolean): T[] {
    const all = [...this.items.values()].map((i) => structuredClone(i));
    return filter ? all.filter(filter) : all;
  }

  insert(item: T): T {
    if (this.items.has(item.id)) throw new Error(`duplicate id ${item.id}`);
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  update(id: string, patch: Partial<T>): T {
    const existing = this.items.get(id);
    if (!existing) throw new Error(`not found: ${id}`);
    const next = { ...existing, ...structuredClone(patch), id };
    this.items.set(id, next);
    return structuredClone(next);
  }
}

/** Audit events are append-only: the collection has no update method. */
export interface AppendOnly<T extends { id: string }> {
  list(filter?: (item: T) => boolean): T[];
  append(item: T): T;
  last(): T | undefined;
}

export class MemoryAppendOnly<T extends { id: string }> implements AppendOnly<T> {
  private items: T[] = [];
  list(filter?: (item: T) => boolean): T[] {
    const all = this.items.map((i) => structuredClone(i));
    return filter ? all.filter(filter) : all;
  }
  append(item: T): T {
    this.items.push(structuredClone(item));
    return structuredClone(item);
  }
  last(): T | undefined {
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
  tasks: Collection<Task>;
  feeRuleVersions: Collection<FeeRuleVersion>;
  billableEvents: Collection<BillableEvent>;
  invoices: Collection<Invoice>;
  enrollments: Collection<SequenceEnrollment>;
  suppressions: Collection<Suppression>;
  audit: AppendOnly<AuditEvent>;
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
    tasks: new MemoryCollection(),
    feeRuleVersions: new MemoryCollection(),
    billableEvents: new MemoryCollection(),
    invoices: new MemoryCollection(),
    enrollments: new MemoryCollection(),
    suppressions: new MemoryCollection(),
    audit: new MemoryAppendOnly(),
  };
}
