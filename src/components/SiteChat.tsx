"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/components/capture";
import LeadForm from "@/components/LeadForm";
import { US_STATES } from "@/config/firm";
import {
  CHAT_DISCLAIMER,
  CHAT_TOPICS,
  chatAnswers,
  QUESTION_CHIP,
  chatBookHref,
  chatCaptureResult,
  chatHiddenOn,
  chatTopic,
  coveredList,
  isCovered,
  matchState,
  searchTerms,
  plainExcerpt,
  stateName,
  topicForText,
  type ChatLink,
} from "@/lib/chat";
import { loadPagefind } from "@/lib/pagefind";
import { loadVisitor } from "@/lib/visitor";
import "./chat.css";

type Step = "topic" | "question" | "state" | "pick_state" | "offer" | "contact" | "done" | "not_covered";

interface Msg {
  id: number;
  from: "bot" | "me";
  text: string;
  links?: ChatLink[];
}

let nextId = 1;
const bot = (text: string, links?: ChatLink[]): Msg => ({ id: nextId++, from: "bot", text, links });
const me = (text: string): Msg => ({ id: nextId++, from: "me", text });

const GREETING = "Hi. I can point you to the right guide, or set up a call with an estate planning attorney in our network. What brings you here?";

/**
 * "Ask us" chat, bottom right on every public page (see src/lib/chat.ts for what it does and does not do).
 * Hidden on staff, client and booking pages. Opens only when the visitor clicks it.
 */
export default function SiteChat({ servedStates, firmPhone }: { servedStates: string[]; firmPhone: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("topic");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  const topic = chatTopic(topicId);
  const sensitive = Boolean(topic?.sensitive);
  const covered = servedStates.filter((s) => s !== "XX");

  useEffect(() => {
    if (!open) return;
    if (msgs.length === 0) setMsgs([bot(GREETING)]);
    const t = setTimeout(() => input.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [msgs, step]);

  if (chatHiddenOn(pathname)) return null;

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  function say(...m: Msg[]) {
    setMsgs((prev) => [...prev, ...m]);
    setSteps((n) => n + 1);
  }

  /** Asks for the state unless we already know it, then moves to the offer. */
  function nextAfterTopic(knownState: string | null, extra: Msg[]) {
    const remembered = knownState ?? loadVisitor()?.contact.state ?? null;
    if (remembered && US_STATES.includes(remembered as (typeof US_STATES)[number])) {
      say(...extra);
      afterState(remembered);
      return;
    }
    say(...extra, bot("Which state do you live in? Attorneys in our network work with families in " + coveredList(covered) + "."));
    setStep("state");
  }

  function pickTopic(id: string) {
    const t = chatTopic(id);
    if (!t) return;
    setTopicId(t.id);
    track("chat_topic", { topic: t.id });
    say(me(t.chip));
    nextAfterTopic(state, [bot(t.reply, t.links)]);
  }

  function askQuestion() {
    track("chat_topic", { topic: "question" });
    say(me(QUESTION_CHIP), bot("Go ahead and type it below. I'll find the pages on our site that cover it. I can't give legal advice here, but an attorney can on a call."));
    setStep("question");
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    say(me(text));

    // A typed state name or code while we are asking for the state.
    if (step === "state" || step === "pick_state" || step === "not_covered") {
      const code = matchState(text);
      if (code) {
        afterState(code);
        return;
      }
    }
    setQuestion((q) => (q ? `${q} | ${text}` : text).slice(0, 500));
    track("chat_question", { step });

    const guess = topicForText(text);
    if (guess && !topicId) setTopicId(guess.id);
    setBusy(true);
    const found = await searchSite(text);
    setBusy(false);
    // Our hand-picked pages for the topic first, then the best search matches.
    const links = [...(guess?.links ?? []), ...found].filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i).slice(0, 4);
    const lead = guess?.sensitive ? "I'm sorry you're dealing with this. " : "";
    const reply = links.length
      ? `${lead}I can't give legal advice in this chat, but these pages on our site cover that:`
      : step === "not_covered"
        ? "I couldn't find a page that matches. Try the full site search."
        : `${lead}I couldn't find a page that matches. An attorney in our network can answer it on a short call.`;
    const replyMsg = bot(reply, links.length ? links : [{ label: "Search the whole site", href: `/search?q=${encodeURIComponent(text.slice(0, 80))}` }]);
    if (step === "offer" || step === "not_covered" || step === "done") {
      say(replyMsg);
      return;
    }
    nextAfterTopic(state, [replyMsg]);
  }

  function afterState(code: string) {
    const up = code.toUpperCase();
    setState(up);
    track("chat_state", { covered: isCovered(up, covered) ? 1 : 0 });
    if (!isCovered(up, covered)) {
      say(
        bot(
          `Thanks. Right now our network only covers ${coveredList(covered)}, so we can't match you with an attorney in ${stateName(up)}. ` +
            "The guides on this site are still free to read, and your state bar's lawyer referral service can connect you with someone licensed there.",
          [{ label: "Help outside our states", href: "/not-in-your-state" }],
        ),
      );
      setStep("not_covered");
      return;
    }
    say(
      bot(
        sensitive
          ? `Attorneys in our network handle estates in ${stateName(up)}. Whenever you're ready, you can pick a time to talk, or leave your details and someone will reach out. There's no pressure.`
          : `Good news: attorneys in our network work with families in ${stateName(up)}. The quickest next step is a short call to talk it through. Or leave your details and someone will reach out.`,
      ),
    );
    setStep("offer");
  }

  function chooseState(code: string) {
    say(me(stateName(code)));
    afterState(code);
  }

  function toContact() {
    track("chat_handoff", { to: "contact", topic: topicId ?? "none" });
    say(me("Have someone reach out"), bot("Sure. Leave your details and someone will get back to you."));
    setStep("contact");
  }

  function reset() {
    setMsgs([bot(GREETING)]);
    setStep("topic");
    setTopicId(null);
    setQuestion(null);
    setSteps(0);
  }

  /** Close the panel after a link click on phones, where it covers the page. */
  function onLink(kind: string) {
    track("chat_link", { kind, topic: topicId ?? "none" });
    if (window.matchMedia("(max-width: 800px)").matches) setOpen(false);
  }

  const showChips = step === "topic" || step === "question";

  return (
    <div className="site-chat no-print">
      {!open && (
        <button
          ref={launcher}
          type="button"
          className="site-chat__launcher"
          aria-haspopup="dialog"
          onClick={() => {
            setOpen(true);
            track("chat_open", { page_type: pathname?.split("/")[1] || "home" });
          }}
        >
          <ChatIcon />
          <span>Questions? Ask us</span>
        </button>
      )}
      {open && (
        <section className="site-chat__panel" role="dialog" aria-modal="false" aria-labelledby="site-chat-title">
          <header className="site-chat__head">
            <div>
              <p id="site-chat-title" className="site-chat__title">Ask us</p>
              <p className="site-chat__sub">Guides, and a call with an attorney. Not legal advice.</p>
            </div>
            <div className="site-chat__head-actions">
              {msgs.length > 1 && (
                <button type="button" className="site-chat__icon" onClick={reset} aria-label="Start over" title="Start over">↺</button>
              )}
              <button type="button" className="site-chat__icon" onClick={close} aria-label="Close chat">×</button>
            </div>
          </header>

          <div className="site-chat__log" ref={log} aria-live="polite">
            <p className="site-chat__disclaimer">{CHAT_DISCLAIMER}</p>
            {msgs.map((m) => (
              <div key={m.id} className={`site-chat__msg site-chat__msg--${m.from}`}>
                <p>{m.text}</p>
                {m.links && m.links.length > 0 && (
                  <ul className="site-chat__links">
                    {m.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} onClick={() => onLink("guide")}>{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && <p className="site-chat__msg site-chat__msg--bot site-chat__typing">Looking that up…</p>}

            {showChips && (
              <div className="site-chat__chips">
                {CHAT_TOPICS.map((t) => (
                  <button key={t.id} type="button" className="site-chat__chip" onClick={() => pickTopic(t.id)}>{t.chip}</button>
                ))}
                {step === "topic" && (
                  <button type="button" className="site-chat__chip site-chat__chip--alt" onClick={askQuestion}>{QUESTION_CHIP}</button>
                )}
              </div>
            )}

            {step === "state" && (
              <div className="site-chat__chips">
                {covered.map((s) => (
                  <button key={s} type="button" className="site-chat__chip" onClick={() => chooseState(s)}>{stateName(s)}</button>
                ))}
                <button type="button" className="site-chat__chip site-chat__chip--alt" onClick={() => { say(me("Another state")); setStep("pick_state"); }}>
                  Another state
                </button>
              </div>
            )}

            {step === "pick_state" && (
              <label className="site-chat__select">
                Choose your state
                <select defaultValue="" onChange={(e) => e.target.value && chooseState(e.target.value)}>
                  <option value="" disabled>State</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{stateName(s)}</option>)}
                </select>
              </label>
            )}

            {step === "offer" && (
              <div className="site-chat__actions">
                <Link
                  className="button"
                  href={chatBookHref(topicId)}
                  onClick={() => {
                    track("chat_handoff", { to: "book", topic: topicId ?? "none" });
                    onLink("book");
                  }}
                >
                  {sensitive ? "Pick a time to talk" : "Book a short intro call"}
                </Link>
                <button type="button" className="button secondary" onClick={toContact}>Have someone reach out</button>
                {firmPhone.replace(/\D/g, "").length >= 10 && (
                  <a className="site-chat__call" href={`tel:${firmPhone.replace(/\D/g, "")}`} onClick={() => track("click_to_call", { from: "chat" })}>
                    Or call {firmPhone}
                  </a>
                )}
              </div>
            )}

            {step === "contact" && (
              <div className="site-chat__form">
                <LeadForm
                  tool="chat"
                  answers={chatAnswers(topicId)}
                  result={chatCaptureResult({ topic: topicId, state, question, steps, page: pathname ?? "" })}
                  legend="Your details"
                  why="Email is enough. Add a phone number if you'd rather get a call."
                  submitLabel="Send"
                  askGoals
                  goalsLabel="Anything you'd like them to know? (optional)"
                  defaultState={state ?? undefined}
                  onBack={() => setStep("offer")}
                  onSuccess={(res) => {
                    track("chat_lead", { topic: topicId ?? "none" });
                    say(
                      bot(
                        res.served
                          ? "Thank you. We have your details and someone will be in touch. You can also pick a time now if that's easier."
                          : `Thank you. Our network only covers ${coveredList(covered)} right now, so we can't take this on, but the guides are yours to use.`,
                        res.served ? [{ label: "Pick a time now", href: chatBookHref(topicId) }] : undefined,
                      ),
                    );
                    setStep("done");
                  }}
                />
              </div>
            )}
          </div>

          {step !== "contact" && (
            <form className="site-chat__input" onSubmit={submitText}>
              <label htmlFor="site-chat-text" className="sr-only">Type your question</label>
              <input
                id="site-chat-text"
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={300}
                autoComplete="off"
                placeholder={step === "state" || step === "pick_state" ? "Type your state" : "Type a question"}
              />
              <button type="submit" className="button" disabled={!draft.trim() || busy}>Send</button>
            </form>
          )}
          <p className="site-chat__foot">Please don&apos;t share account numbers or medical details here.</p>
        </section>
      )}
    </div>
  );
}

async function searchSite(q: string): Promise<ChatLink[]> {
  try {
    const terms = searchTerms(q);
    if (!terms) return [];
    const pf = await loadPagefind();
    const res = await pf.search(terms);
    if (!res) return [];
    const hits = await Promise.all(res.results.slice(0, 3).map((r) => r.data()));
    return hits.map((h) => ({ label: h.meta.title ?? plainExcerpt(h.excerpt, 70), href: h.url.replace(/\.html$/, "") }));
  } catch {
    return [];
  }
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}
