"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function send(url: string, method: string, body: unknown): Promise<void> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
}

function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, onDone?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { run, error, busy };
}

const TYPES: [string, string][] = [
  ["cpa", "CPA or tax preparer"],
  ["financial_advisor", "Financial advisor"],
  ["funeral_home", "Funeral home"],
  ["elder_care", "Elder care"],
  ["realtor", "Realtor, title or mortgage"],
  ["other", "Other professional"],
];

export function PartnerCreate({ firmId }: { firmId?: string }) {
  const { run, error, busy } = useAction();
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) ?? "").trim();
        run(
          () => send("/api/portal/partners", "POST", { slug: get("slug"), name: get("name"), org: get("org"), type: get("type"), firmId, status: "prospect" }),
          () => (e.target as HTMLFormElement).reset(),
        );
      }}
    >
      <h2 style={{ marginTop: 0 }}>Add a partner</h2>
      <div className="field-row">
        <label className="field">Contact name<input name="name" required /></label>
        <label className="field">Organization<input name="org" required /></label>
      </div>
      <div className="field-row">
        <label className="field">Type
          <select name="type" defaultValue="cpa">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="field">Page slug (becomes /partners/slug and ref-slug)<input name="slug" required pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?" /></label>
      </div>
      <button className="button secondary" disabled={busy}>Add partner</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

const STATUSES: [string, string][] = [
  ["prospect", "Prospect"],
  ["active_sequence", "In outreach sequence"],
  ["active", "Active (page is live)"],
  ["paused", "Paused"],
  ["do_not_contact", "Do not contact"],
];

export function PartnerStatus({ id, status, reciprocal, nonexclusive }: { id: string; status: string; reciprocal: boolean; nonexclusive: boolean }) {
  const { run, error, busy } = useAction();
  const patch = (body: Record<string, unknown>) => run(() => send(`/api/portal/partners/${id}`, "PATCH", body));
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <label className="field">Status
        <select value={status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={reciprocal} disabled={busy} onChange={(e) => patch({ reciprocalAgreementOnFile: e.target.checked })} />
        <span>Reciprocal referral agreement on file</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={nonexclusive} disabled={busy} onChange={(e) => patch({ agreementNonexclusive: e.target.checked })} />
        <span>Agreement is non-exclusive (required by Rule 7.2(b)(4))</span>
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function GiftForm({ partnerId, today }: { partnerId: string; today: string }) {
  const { run, error, busy } = useAction();
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const get = (k: string) => String(f.get(k) ?? "").trim();
        run(
          () =>
            send(`/api/portal/partners/${partnerId}/gifts`, "POST", {
              date: get("date"),
              description: get("description"),
              valueUsd: get("valueUsd"),
              tiedToReferral: f.get("tied") === "on",
              thingOfValue: f.get("thing") === "on",
              note: get("note"),
            }),
          () => (e.target as HTMLFormElement).reset(),
        );
      }}
    >
      <h3 style={{ marginTop: 0 }}>Log a gift</h3>
      <p className="notice">
        Nominal gifts only, never tied to a referral. Anything tied to a referral, and any payment or other thing of value, is refused and not logged
        (Rule 7.2(b)). Gifts over the limits are logged and flagged for the attorney.
      </p>
      <div className="field-row">
        <label className="field">Date<input name="date" type="date" defaultValue={today} required /></label>
        <label className="field">Value in dollars<input name="valueUsd" inputMode="decimal" required /></label>
      </div>
      <label className="field">What was it<input name="description" required /></label>
      <label className="check">
        <input type="checkbox" name="tied" />
        <span>Thing of value? This gift or benefit is connected to a referral (promised, expected or thanks for one)</span>
      </label>
      <label className="check">
        <input type="checkbox" name="thing" />
        <span>It is a payment, commission, fee share, free work or other thing of value, not a token item</span>
      </label>
      <label className="field">Note for the attorney (optional)<input name="note" /></label>
      <button className="button secondary" disabled={busy}>Check and log</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

const RELEASES: [string, string][] = [
  ["none", "None"],
  ["requested", "Requested"],
  ["granted", "Granted (signed)"],
  ["revoked", "Revoked"],
];

export function ReferralControls(props: { id: string; releaseStatus: string; disclosureGiven: boolean; valueLinked: string }) {
  const { run, error, busy } = useAction();
  const post = (body: Record<string, unknown>) => run(() => send(`/api/portal/partner-referrals/${props.id}`, "POST", body));
  return (
    <div>
      <label className="check">
        <input type="checkbox" checked={props.disclosureGiven} disabled={busy} onChange={(e) => post({ disclosureGiven: e.target.checked })} />
        <span>Disclosure given</span>
      </label>
      <label className="field">Release
        <select value={props.releaseStatus} disabled={busy} onChange={(e) => post({ release: e.target.value })}>
          {RELEASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <p className="notice" style={{ margin: 0 }}>Anything of value linked to this referral?</p>
      <div className="nav">
        <button className="button secondary small" disabled={busy || props.valueLinked === "no"} onClick={() => post({ valueLinked: false })}>No</button>
        <button
          className="button secondary small"
          disabled={busy || props.valueLinked === "yes"}
          onClick={() => {
            const note = window.prompt("Describe what is linked to this referral. The attorney will review it.");
            if (note?.trim()) post({ valueLinked: true, valueNote: note });
          }}
        >
          Yes
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
