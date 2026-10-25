"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CalcomEmbed from "@/components/CalcomEmbed";
import { CallbackForm, track } from "@/components/capture";
import { firm, US_STATES } from "@/config/firm";
import { BOOK_TOPICS, bookingNotes, bookTopic, parseBookParams } from "@/lib/book";
import { isServedState } from "@/lib/planFinder";
import { loadVisitor } from "@/lib/visitor";

/**
 * Calendar-first booking. Two optional taps (state, topic) sit above the calendar; nothing has to be
 * answered before a time can be picked. Out-of-state visitors are told before they book, not after.
 * Analytics carry placement and topic id only, never contact details.
 */
export default function BookFlow({ servedStates, defaultState }: { servedStates: string[]; defaultState: string }) {
  const [from, setFrom] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [state, setState] = useState(defaultState);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    const p = parseBookParams(window.location.search);
    setFrom(p.from);
    if (p.topic) setTopic(p.topic);
    const known = loadVisitor()?.contact.state;
    if (known) setState(known);
    track("book_view", { from: p.from ?? "direct" });
  }, []);

  const served = isServedState(state, servedStates);
  const t = bookTopic(topic);
  const digits = firm.phone.replace(/\D/g, "");
  const scheduler = firm.schedulerUrl && /^https:\/\//i.test(firm.schedulerUrl) ? firm.schedulerUrl : null;

  if (booked) {
    return (
      <section className="card" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>You are booked</h2>
        <p>A confirmation is on its way to your email, with a link to change the time if you need to.</p>
        <h3>Get the most out of the call (optional)</h3>
        <ul>
          <li><Link href="/my-plan">Start your family plan organizer</Link>: list your people, what you own and the documents you already have. You can share it with the attorney before the call.</li>
          <li><Link href="/free/consult-prep-workbook">Print the consult prep workbook</Link> and jot down your questions.</li>
          <li>Have any existing will, trust or deed handy. Leave out account and Social Security numbers.</li>
        </ul>
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="book-state">
        <h2 id="book-state">1. Where do you live?</h2>
        <label className="field" style={{ maxWidth: 320 }}>
          State
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              track("book_state", { served: isServedState(e.target.value, servedStates) ? 1 : 0 });
            }}
          >
            <option value="" disabled>Choose a state</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {!served && state && (
          <p className="notice" role="status">
            We can only advise on the law of {servedStates.join(", ")} right now, so we would not be able to help after the call.{" "}
            <Link href="/not-in-your-state">Here is how to find a licensed estate planning attorney where you live.</Link>
          </p>
        )}
      </section>

      {served && (
        <>
          <section aria-labelledby="book-topic">
            <h2 id="book-topic">2. What would you like to talk about? <span className="notice">(optional)</span></h2>
            <div className="inline-options" role="radiogroup" aria-labelledby="book-topic">
              {BOOK_TOPICS.map((o) => (
                <label className="option" key={o.id}>
                  <input
                    type="radio"
                    name="topic"
                    value={o.id}
                    checked={topic === o.id}
                    onChange={() => {
                      setTopic(o.id);
                      track("book_topic", { topic: o.id });
                    }}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
            {t?.urgent && (
              <p className="notice" role="status">
                We are sorry for your loss. If there is a deadline, a hearing or a home that needs securing, please call{" "}
                <a href={`tel:${digits}`}>{firm.phone}</a> so we can help sooner. Otherwise, pick a time below.
              </p>
            )}
          </section>

          <section aria-labelledby="book-time">
            <h2 id="book-time">3. Pick a time</h2>
            {firm.calcomLink ? (
              <>
                <CalcomEmbed
                  link={firm.calcomLink}
                  notes={bookingNotes(topic, from)}
                  metadata={{ from: from ?? "direct", topic: topic ?? "" }}
                  onBooked={() => setBooked(true)}
                />
                <p className="notice">
                  Calendar not loading? <a href={`https://cal.com/${firm.calcomLink}`} target="_blank" rel="noopener noreferrer">Open the scheduling page in a new tab</a>, or call {firm.phone}.
                </p>
              </>
            ) : scheduler ? (
              <>
                <iframe className="scheduler" src={scheduler} title="Consult scheduling calendar" loading="lazy" style={{ width: "100%", minHeight: 680, border: 0 }} />
                <p className="notice">
                  Calendar not loading? <a href={scheduler} target="_blank" rel="noopener noreferrer">Open the scheduling page in a new tab</a>.
                </p>
              </>
            ) : (
              <>
                <p>
                  Online booking is not switched on yet. Leave your number and the best time to call, and our intake team will set up the
                  consult with you ({firm.officeHours}). Or call <a href={`tel:${digits}`}>{firm.phone}</a>.
                </p>
                <CallbackForm interest={topic ? `book_${topic}` : "book"} />
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
