import Link from "next/link";
import { servedStates, US_STATES } from "@/config/firm";
import { HEARD_FROM_OPTIONS } from "@/lib/heardFrom";
import { can } from "@/server/auth/policy";
import { currentActor, getDb } from "@/server/runtime";
import { assignableLawyers, assignChoices, ENTRY_CHANNELS } from "@/server/services/manualLead";
import styles from "../leads.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a lead", robots: { index: false, follow: false } };

type Opt = [string, string][];
const MATTER: Opt = [["new_plan", "First estate plan"], ["update_plan", "Update an existing plan"], ["after_death", "Someone passed away (probate or trust administration)"], ["elder_care", "Long-term care or an aging parent"], ["not_sure", "Not sure yet"]];
const MARITAL: Opt = [["single", "Single"], ["married", "Married"], ["partnered", "Partner, not married"], ["divorced", "Divorced or separated"], ["widowed", "Widowed"]];
const CHILDREN: Opt = [["none", "No children"], ["minors", "Minor children"], ["adults", "Adult children"], ["both", "Both minor and adult"]];
const ASSETS: Opt = [["under_250k", "Under $250k"], ["250k_1m", "$250k to $1M"], ["1m_5m", "$1M to $5M"], ["over_5m", "Over $5M"], ["prefer_not", "Did not say"]];
const DOCS: Opt = [["none", "Nothing in place"], ["will_only", "Has a will"], ["trust", "Has a trust"], ["not_sure", "Not sure"]];
const URGENCY: Opt = [["exploring", "Just exploring"], ["this_month", "Wants it done this month"], ["health_event", "Health event or surgery coming"], ["recent_death", "Recent death in the family"]];
const YN: Opt = [["yes", "Yes"], ["no", "No"]];

function Select({ name, label, options, hint, defaultValue, required }: { name: string; label: string; options: Opt; hint?: string; defaultValue?: string; required?: boolean }) {
  return (
    <label className={styles.fField}>
      <span>{label}{required && <b aria-hidden> *</b>}</span>
      <select name={name} defaultValue={defaultValue ?? ""} required={required}>
        {!required && <option value="">Not asked</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Input({ name, label, type = "text", hint, required, autoComplete, wide, placeholder }: { name: string; label: string; type?: string; hint?: string; required?: boolean; autoComplete?: string; wide?: boolean; placeholder?: string }) {
  return (
    <label className={`${styles.fField} ${wide ? styles.fWide : ""}`}>
      <span>{label}{required && <b aria-hidden> *</b>}</span>
      <input type={type} name={name} required={required} autoComplete={autoComplete} placeholder={placeholder} maxLength={200} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "create_lead")) return <p>Adding leads is for intake, the office and attorneys.</p>;
  const { error } = await searchParams;
  const lawyers = await assignableLawyers(await getDb(), actor);
  const choices = assignChoices(actor);
  const states = servedStates();

  return (
    <div className={styles.page}>
      <p className={styles.crumbs}><Link href="/portal">Home</Link> › Add a lead</p>
      <header className={styles.hero}>
        <div>
          <h1>Add a lead</h1>
          <p className={styles.heroSub}>For a phone call, a walk-in or a referral. Only the name and a phone or email are needed; fill in what you learned on the call.</p>
        </div>
      </header>
      {error && <p className={styles.fError} role="alert">{error}</p>}

      <form method="post" action="/api/portal/leads" className={styles.fForm}>
        <section className={styles.fSection}>
          <h2>Who is it</h2>
          <div className={styles.fGrid}>
            <Input name="firstName" label="First name" required autoComplete="off" />
            <Input name="lastName" label="Last name" autoComplete="off" />
            <Input name="phone" label="Phone" type="tel" hint="10-digit US number" autoComplete="off" />
            <Input name="email" label="Email" type="email" hint="A phone or an email is needed" autoComplete="off" />
            <Input name="county" label="County" placeholder="Kane" />
            <label className={styles.fField}>
              <span>State</span>
              <select name="state" defaultValue={states[0] ?? "IL"}>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
                <optgroup label="Other states">{US_STATES.filter((s) => !states.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
              </select>
              <small>Out-of-state leads are logged as not a fit</small>
            </label>
            <Select name="contactMethod" label="Best way to reach them" options={[["phone", "Call"], ["text", "Text"], ["email", "Email"]]} defaultValue="phone" required />
          </div>
        </section>

        <section className={styles.fSection}>
          <h2>How they reached us</h2>
          <div className={styles.fGrid}>
            <Select name="channel" label="Came in by" options={ENTRY_CHANNELS.map((c) => [c.value, c.label])} defaultValue="phone_call" required />
            <Input name="referredBy" label="Referred by" hint="Name of the person or firm, if any" />
            <Select name="heardFrom" label="How they heard about us" options={HEARD_FROM_OPTIONS.map((o) => [o.value, o.label])} />
          </div>
        </section>

        <section className={styles.fSection}>
          <h2>What they need</h2>
          <p className={styles.fHint}>These feed the lead score and pre-fill the attorney&apos;s intake form. Skip anything you did not ask.</p>
          <div className={styles.fGrid}>
            <Select name="matterType" label="Looking for" options={MATTER} />
            <Select name="urgency" label="Timing" options={URGENCY} />
            <Select name="maritalStatus" label="Marital status" options={MARITAL} />
            <Select name="children" label="Children" options={CHILDREN} />
            <Select name="specialNeeds" label="Anyone with special needs?" options={YN} />
            <Select name="ownsHome" label="Owns a home?" options={YN} />
            <Select name="outOfStateProperty" label="Property in another state?" options={YN} />
            <Select name="ownsBusiness" label="Owns a business?" options={YN} />
            <Select name="assetRange" label="Rough estate size" options={ASSETS} />
            <Select name="existingDocuments" label="Existing documents" options={DOCS} />
          </div>
          <label className={`${styles.fField} ${styles.fWide}`}>
            <span>Notes from the call</span>
            <textarea name="notes" rows={4} maxLength={2000} placeholder="What they want, family situation, anything urgent" />
            <small>Shown on the lead and posted to its comment thread</small>
          </label>
        </section>

        <section className={styles.fSection}>
          <h2>Who handles it</h2>
          {actor.role === "attorney" ? (
            <p className={styles.fHint}>You took this one, so it is assigned to you{lawyers[0] ? ` (${lawyers[0].name.replace(/,?\s*Esq\.?$/i, "")})` : ""}. You can refer it on from the lead&apos;s page.</p>
          ) : (
            <div className={styles.fGrid}>
              <label className={styles.fField}>
                <span>Assign to</span>
                <select name="assignTo" defaultValue={choices.queue ? "" : lawyers[0]?.id ?? ""} required={!choices.queue}>
                  {choices.queue && <option value="">Leave in the intake queue</option>}
                  {choices.auto && <option value="auto">Offer to the best-matched attorney</option>}
                  {lawyers.map((l) => <option key={l.id} value={l.id}>{l.name.replace(/,?\s*Esq\.?$/i, "")}</option>)}
                </select>
                <small>Assigning skips the offer step. Run the conflict check from the lead&apos;s page.</small>
              </label>
            </div>
          )}
        </section>

        <div className={styles.fActions}>
          <Link href="/portal">Cancel</Link>
          <button type="submit" className="button">Add lead</button>
        </div>
      </form>
    </div>
  );
}
