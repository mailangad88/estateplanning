"use client";

import { useState } from "react";
import LeadForm, { type LeadResponse } from "@/components/LeadForm";
import { firm } from "@/config/firm";

const TIMES = [
  { value: "asap", label: "As soon as possible" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Early evening" },
];

export default function Callback() {
  const [bestTime, setBestTime] = useState("asap");
  const [done, setDone] = useState<LeadResponse | null>(null);

  if (done) {
    return (
      <section aria-live="polite">
        <h1>Thanks. We will call you.</h1>
        <p className="lead">
          {done.served
            ? `A member of our intake team will call during office hours (${firm.hours}).`
            : "We are not able to help in your state yet. Your state bar's lawyer referral service can connect you with a licensed attorney near you."}
        </p>
      </section>
    );
  }

  return (
    <>
      <h1>Request a call back</h1>
      <p className="lead">Prefer to talk? Leave your number and we will call you. Office hours: {firm.hours}.</p>
      <fieldset className="question">
        <legend style={{ fontSize: "1rem" }}>When is a good time?</legend>
        <div className="inline-options">
          {TIMES.map((t) => (
            <label className="option" key={t.value}>
              <input type="radio" name="bestTime" checked={bestTime === t.value} onChange={() => setBestTime(t.value)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <LeadForm
        tool="callback"
        result={{ bestTime }}
        legend="Your details"
        submitLabel="Call me back"
        askGoals
        goalsLabel="What would you like to talk about? (optional)"
        onSuccess={setDone}
      />
    </>
  );
}
