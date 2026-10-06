"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import {
  CRITERIA, CRITERIA_SHORT, CRITERIA_TEXT, FLAG_NOTES, candidateLabel, defaultImportance, drivers, rank,
  type AgeBand, type Candidate, type Crit, type Rating, type Weight,
} from "@/lib/tools/guardianPicker";

const SLUG = "guardian-picker";
const AGES: [AgeBand, string][] = [["under_40", "Under 40"], ["40_54", "40 to 54"], ["55_69", "55 to 69"], ["70_plus", "70 or older"]];
const IMPORTANCE: [Weight, string][] = [[1, "Matters a little"], [2, "Matters"], [3, "Matters a lot"]];
const KIDS: [string, string][] = [["0_5", "0 to 5"], ["6_12", "6 to 12"], ["13_17", "13 to 17"]];

let seq = 0;
const blank = (): Candidate => ({
  id: `c${++seq}`, label: "", ageBand: "40_54", asked: "no",
  ratings: { values: 3, health: 3, location: 3, willing: 3, bond: 3, finances: 3, household: 3 },
});

export default function GuardianPicker() {
  const [cands, setCands] = useState<Candidate[]>(() => [blank()]);
  const [importance, setImportance] = useState(defaultImportance);
  const [kids, setKids] = useState<string[]>([]);
  const [shown, setShown] = useState(false);
  const started = useRef(false);
  const completed = useRef(false);

  const start = () => {
    if (!started.current) { started.current = true; track("tool_start", { tool_id: SLUG }); }
  };
  const patch = (id: string, p: Partial<Candidate>) => { start(); setCands((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c))); };
  const rate = (id: string, k: Crit, v: Rating) => { start(); setCands((cs) => cs.map((c) => (c.id === id ? { ...c, ratings: { ...c.ratings, [k]: v } } : c))); };

  const r = rank(importance, cands);
  const nameOf = (id: string) => candidateLabel(cands.find((c) => c.id === id)!, cands.findIndex((c) => c.id === id));
  const top = r.scored[0];
  const second = r.scored[1];
  const why = drivers(importance, cands);
  const flagged = r.scored.flatMap((s) => s.flags.map((f) => [s.id, f] as const));

  const showResult = () => {
    setShown(true);
    if (!completed.current) { completed.current = true; track("tool_complete", { tool_id: SLUG }); }
  };

  return (
    <>
      <div className="tool">
        <p className="notice">
          Names stay in this browser tab. If you ask for an email, we send only scores and counts, never the names you type.
          Nothing here is saved, so print or email before you leave.
        </p>

        <fieldset className="question">
          <legend>How old are your children? (select all)</legend>
          <div className="inline-options">
            {KIDS.map(([v, l]) => (
              <label className="check" key={v}>
                <input type="checkbox" checked={kids.includes(v)} onChange={(e) => { start(); setKids((k) => (e.target.checked ? [...k, v] : k.filter((x) => x !== v))); }} />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <h3>Who are you considering? Add up to three.</h3>
        <p className="notice">If the other parent is living and fit, they would usually have custody. This tool is for the case where neither parent can. For a couple, add them as one person and rate the household.</p>
        {cands.map((c, i) => (
          <div className="card" key={c.id}>
            <div className="row">
              <label className="field">
                First name or nickname
                <input value={c.label} placeholder={`Person ${i + 1}`} maxLength={30} onChange={(e) => patch(c.id, { label: e.target.value })} />
              </label>
              <label className="field">
                Age
                <select value={c.ageBand} onChange={(e) => patch(c.id, { ageBand: e.target.value as AgeBand })}>
                  {AGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="field">
                Have you asked them?
                <select value={c.asked} onChange={(e) => patch(c.id, { asked: e.target.value as "yes" | "no" })}>
                  <option value="no">Not yet</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </div>
            {cands.length > 1 && (
              <button type="button" className="button" onClick={() => setCands((cs) => cs.filter((x) => x.id !== c.id))}>Remove {candidateLabel(c, i)}</button>
            )}
          </div>
        ))}
        {cands.length < 3 && (
          <button type="button" className="button" onClick={() => { start(); setCands((cs) => [...cs, blank()]); }}>Add another person</button>
        )}

        <h3>How much does each of these matter to you?</h3>
        {CRITERIA.map((k) => (
          <label className="field" key={k}>
            {CRITERIA_TEXT[k]}
            <select value={importance[k]} onChange={(e) => { start(); setImportance((w) => ({ ...w, [k]: Number(e.target.value) as Weight })); }}>
              {IMPORTANCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ))}

        <h3>How well does each statement fit each person?</h3>
        <p className="notice">1 is poorly, 5 is very well.</p>
        {CRITERIA.map((k) => (
          <fieldset className="question" key={k}>
            <legend style={{ fontSize: "1rem" }}>{CRITERIA_TEXT[k]}</legend>
            {cands.map((c, i) => (
              <div className="inline-options" key={c.id} role="radiogroup" aria-label={`${candidateLabel(c, i)}: ${CRITERIA_SHORT[k]}`}>
                <span style={{ minWidth: 90 }}>{candidateLabel(c, i)}</span>
                {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
                  <label className="option" key={n}>
                    <input type="radio" name={`${c.id}-${k}`} checked={c.ratings[k] === n} onChange={() => rate(c.id, k, n)} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>
        ))}

        <button type="button" className="button" onClick={showResult}>Compare</button>
      </div>

      {shown && (
        <>
          <div className="result" aria-live="polite">
            {second ? (
              <p className="big" style={{ fontSize: "1.5rem" }}>
                On the priorities you chose, {nameOf(top.id)} has the highest fit ({top.score} of 100), with {nameOf(second.id)} close behind ({second.score}).
              </p>
            ) : (
              <p className="big" style={{ fontSize: "1.5rem" }}>On the priorities you chose, {nameOf(top.id)} fits at {top.score} of 100 against your ideal.</p>
            )}
            {r.close && <p>These two are very close. The numbers can&apos;t settle it; a conversation might.</p>}
            {r.scored.map((s) => (
              <div key={s.id}>
                {nameOf(s.id)}: <strong>{s.score} of 100</strong>
                <div className="bar" style={{ margin: "4px 0 10px" }} aria-hidden="true"><span style={{ width: `${s.score}%` }} /></div>
              </div>
            ))}
            <p className="notice">A score is a conversation aid, not a verdict.</p>
          </div>

          {why.length > 0 && (
            <p><strong>What drove the ranking:</strong> the biggest differences were {why.map((k) => CRITERIA_SHORT[k]).join(" and ")}.</p>
          )}

          {flagged.length > 0 && (
            <div className="card">
              <strong>Things to think about</strong>
              <ul>{flagged.map(([id, f]) => <li key={id + f}><em>{nameOf(id)}:</em> {FLAG_NOTES[f]}</li>)}</ul>
            </div>
          )}

          <div className="card">
            <strong>Name a backup</strong>
            <p>People commonly name a first choice and at least one backup.{r.backup ? ` On your numbers, ${nameOf(r.backup)} could be that backup.` : ""}</p>
          </div>
          <div className="card">
            <strong>Guardian and money are separate decisions</strong>
            <p>The person who raises your children and the person who manages their money don&apos;t have to be the same. Many parents split these roles so there is a check and balance. This is usually done with a trust or custodian provisions. Ask an attorney. Related: <Link href="/tools/will-or-trust">will or trust?</Link> and <Link href="/tools/guardian-fund-calculator">how much money might a guardian need?</Link></p>
          </div>
          <div className="card">
            <strong>What the law generally says</strong>
            <p>In every state a parent can nominate a guardian in a will, and the court generally appoints the nominee unless it finds that would not serve the child&apos;s interests. Without a nomination, the court chooses and relatives may disagree. Details vary by state, so ask an attorney.</p>
          </div>
          <div className="card">
            <strong>Until the paperwork is done</strong>
            <p>A will isn&apos;t read right away. Many families also write a short note of emergency contacts and who has the children tonight. Our <Link href="/free/guardian-for-your-kids-worksheet">guardian worksheet</Link> includes a script for the ask and a letter to your chosen guardian. If a child has a disability, a guardian may continue into adulthood, so ask an attorney about special needs planning.</p>
          </div>

          <EmailCapture
            kind="report"
            interest={`tool:${SLUG}`}
            title="Email me the printable guardian kit"
            body="We'll send a comparison table, a one-page sheet for who has the children tonight, and a letter-to-guardian template. We use only your scores and counts, never the names you typed."
            details={{
              candidates: cands.length,
              topScore: top.score,
              secondScore: second?.score ?? 0,
              closeCall: r.close,
              notAsked: cands.filter((c) => c.asked === "no").length,
              youngKids: kids.includes("0_5"),
            }}
          />

          <h3>When to talk to an attorney</h3>
          <p>Naming a guardian in a will is a nomination, and a court makes the final decision based on what serves the child&apos;s interests. An attorney can put your choice and a backup in writing, and set up money for the children. <Link href="/plan-finder">Book a consult</Link>.</p>
          <p className="notice">This is general educational information, not legal advice, and using this tool does not create an attorney-client relationship. Laws change and your facts matter.</p>
        </>
      )}
    </>
  );
}
