/** In-memory adapter for tests and local development. Records every call. */
import { assertFirmVisible, type CrmAdapter, type NurtureState } from "@/server/crm/adapter";
import type { Activity, Comment, DocumentRecord, ExitReason, Lead, Person, Stage } from "@/server/types";

export interface MockCall {
  op: string;
  args: unknown[];
}

export class MockCrmAdapter implements CrmAdapter {
  readonly name = "mock";
  calls: MockCall[] = [];
  nurtureStates = new Map<string, NurtureState>();
  contacts = new Map<string, string>(); // email -> id
  matters = new Map<string, { stage: Stage; exit?: ExitReason; notes: string[] }>();
  /** Test hook: throw this before running the next operation(s). */
  failWith: unknown[] = [];

  private rec(op: string, ...args: unknown[]) {
    this.calls.push({ op, args });
    const err = this.failWith.shift();
    if (err) throw err;
  }

  count(op: string): number {
    return this.calls.filter((c) => c.op === op).length;
  }

  async upsertContact(person: Person, _lead: Lead) {
    this.rec("upsertContact", person);
    let id = this.contacts.get(person.email);
    if (!id) {
      id = `contact_${this.contacts.size + 1}`;
      this.contacts.set(person.email, id);
    }
    return { contactId: id };
  }

  async upsertMatter(lead: Lead, person: Person, ctx: { contactId: string }) {
    this.rec("upsertMatter", lead, person, ctx);
    const id = `matter_${this.matters.size + 1}`;
    this.matters.set(id, { stage: lead.stage, exit: lead.exit?.reason, notes: [] });
    return { matterId: id };
  }

  async setStage(matterId: string, stage: Stage, exit?: ExitReason) {
    this.rec("setStage", matterId, stage, exit);
    const m = this.matters.get(matterId);
    if (m) Object.assign(m, { stage, exit });
  }

  async logActivity(matterId: string, activity: Activity) {
    this.rec("logActivity", matterId, activity);
  }

  async addNote(matterId: string, comment: Comment) {
    assertFirmVisible(comment);
    this.rec("addNote", matterId, comment);
    this.matters.get(matterId)?.notes.push(comment.body);
  }

  async attachDocument(
    matterId: string,
    doc: Pick<DocumentRecord, "id" | "name" | "kind" | "contentType" | "sizeBytes">,
    url: string,
  ) {
    this.rec("attachDocument", matterId, doc, url);
  }

  async pushNurtureState(matterId: string, state: NurtureState) {
    this.rec("pushNurtureState", matterId, state);
    this.nurtureStates.set(matterId, state);
  }
}
