"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Baby, Briefcase, CalendarCheck, Check, CircleAlert, Dices, FileText, Flag, HandHeart, Heart,
  House, Landmark, Lock, PiggyBank, Phone, RotateCcw, ShieldCheck, Stethoscope, Sun, Trophy, Users, X, type LucideIcon,
} from "lucide-react";
import type { ResolvedDoc, ResolvedSquare } from "@/config/life-game";
import { handOffToPlan } from "@/lib/familyPlanHandoff";

const ICONS: Record<string, LucideIcon> = {
  Baby, Briefcase, CalendarCheck, FileText, Flag, HandHeart, Heart, House, Landmark, Lock, PiggyBank, ShieldCheck, Stethoscope, Sun, Trophy, Users,
};
const Icon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const C = ICONS[name] ?? FileText;
  return <C size={size} aria-hidden="true" />;
};

type Choice = "plan" | "wait";

export interface LifeGameProps {
  squares: ResolvedSquare[];
  /** Where "book a call" goes. Sensitive pages pass /contact so no answers are collected. */
  bookHref: string;
  phone: string;
  /** Optional second step for this page, such as the stage's plan finder. */
  next?: { label: string; href: string };
  /** Larger type and the phone number first. */
  senior?: boolean;
  /** Every what-if for this page, listed under the board. Defaults to the board's own squares. */
  library?: ResolvedSquare[];
  /** id for the heading, so several boards can sit on one site. */
  id?: string;
}

/**
 * The life game. The visitor moves along a board; at each "what if" square they choose to plan for
 * it or put it off, and see what usually happens either way. Every plan they make adds a document to
 * their plan tray, and the finish square shows the plan with a way to make it real.
 *
 * Nothing the visitor picks leaves the page: no tracking, no storage, so it is safe on sensitive pages.
 * The one exception is explicit: clicking "organize your real family plan" on the finish square keeps
 * the planned document keys on this device for /my-plan to start from (not offered on sensitive pages).
 */
export function LifeGame({ squares, bookHref, phone, next, senior, library, id = "life-game" }: LifeGameProps) {
  const [at, setAt] = useState(0);
  const [reached, setReached] = useState(0);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  const whatifs = squares.filter((s) => s.kind === "whatif");
  const planned = whatifs.filter((s) => choices[s.id] === "plan");
  const waited = whatifs.filter((s) => choices[s.id] === "wait");
  const covered = planned.length;
  const total = whatifs.length;

  // Every document the board can add, in the order it first appears.
  const allDocs: ResolvedDoc[] = [];
  for (const s of whatifs) for (const d of s.docs ?? []) if (!allDocs.some((x) => x.key === d.key)) allDocs.push(d);
  const inPlan = new Set(planned.flatMap((s) => s.docs?.map((d) => d.key) ?? []));

  const square = squares[at];
  const choice = choices[square.id];
  const last = squares.length - 1;
  const digits = phone.replace(/\D/g, "");

  function go(i: number) {
    const to = Math.max(0, Math.min(last, i));
    setAt(to);
    setReached((r) => Math.max(r, to));
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }
  function choose(c: Choice) {
    setChoices((prev) => ({ ...prev, [square.id]: c }));
  }
  function restart() {
    setChoices({});
    setReached(0);
    go(0);
  }

  const canMove = square.kind !== "whatif" || Boolean(choice);

  return (
    <div className={`lgame${senior ? " lgame--senior" : ""}`}>
      {/* The board: one tile per square, the pawn sits on the current one. */}
      <ol className="lgame__board" aria-label="Game board" style={{ ["--n" as string]: squares.length }}>
        {squares.map((s, i) => {
          const c = choices[s.id];
          const state = c === "plan" ? "is-covered" : c === "wait" ? "is-risk" : i <= reached ? "is-seen" : "is-ahead";
          const here = i === at;
          return (
            <li key={s.id} className={`lgame-tile lgame-tile--${s.kind} ${state}${here ? " is-here" : ""}`}>
              <button
                type="button"
                className="lgame-tile__btn"
                onClick={() => go(i)}
                disabled={i > reached + 1 && !here}
                aria-current={here ? "step" : undefined}
                aria-label={`Square ${i + 1}: ${s.title}${c === "plan" ? ", planned for" : c === "wait" ? ", put off" : ""}`}
              >
                <span className="lgame-tile__dot">
                  {c === "plan" ? <Check size={24} aria-hidden="true" /> : c === "wait" ? <X size={24} aria-hidden="true" /> : s.kind === "whatif" ? <span className="lgame-tile__q" aria-hidden="true">?</span> : <Icon name={s.icon} size={24} />}
                  {here && <span className="lgame-pawn" aria-hidden="true" />}
                </span>
                <span className="lgame-tile__label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lgame__play">
        {/* The card for the current square. */}
        <div className={`lgame-card lgame-card--${square.kind}${choice ? ` is-${choice}` : ""}`}>
          {square.art && square.kind !== "finish" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="lgame-card__art" src={`/media/illustrations/${square.art}.webp`} alt="" width={1600} height={960} loading="lazy" decoding="async" />
          )}
          <div className="lgame-card__body">
            <p className="lgame-card__step">
              <span className={`lgame-chip lgame-chip--${square.kind}`}>
                {square.kind === "whatif" ? "What if?" : square.kind === "moment" ? "Life happens" : square.kind === "start" ? "Start" : "Finish"}
              </span>
              <span>Square {at + 1} of {squares.length}</span>
              {square.stage && (
                <Link href={square.stage.href} className="lgame-card__stage">{square.stage.label}</Link>
              )}
            </p>
            <h3 id={`${id}-card`} ref={headingRef} tabIndex={-1}>{square.kind === "finish" ? finishTitle(covered, total) : square.title}</h3>

            <div aria-live="polite">
              {square.kind === "start" && (
                <>
                  <p className="lgame-card__text">{square.text}</p>
                  <p className="lgame-card__how">At each <strong>What if?</strong> square you choose: plan for it, or put it off. Your plan builds on the right.</p>
                </>
              )}
              {square.kind === "moment" && <p className="lgame-card__text">{square.text}</p>}

              {square.kind === "whatif" && (
                <>
                  <blockquote className="lgame-card__delay">
                    <span>What people often say</span>
                    &ldquo;{square.delay}&rdquo;
                  </blockquote>
                  {!choice && (
                    <div className="lgame-choices" role="group" aria-label="Your choice">
                      <button type="button" className="lgame-choice lgame-choice--plan" onClick={() => choose("plan")}>
                        <ShieldCheck size={22} aria-hidden="true" /> Plan for it
                      </button>
                      <button type="button" className="lgame-choice lgame-choice--wait" onClick={() => choose("wait")}>
                        <CircleAlert size={22} aria-hidden="true" /> Put it off
                      </button>
                    </div>
                  )}
                  {choice === "wait" && (
                    <div className="lgame-result lgame-result--wait">
                      <p className="lgame-result__h"><CircleAlert size={20} aria-hidden="true" /> If it waits, this is what usually happens</p>
                      <p>{square.without}</p>
                      {square.learn && (
                        <p><Link href={square.learn} className="arrow-link">Read more about this <ArrowRight size={16} aria-hidden="true" /></Link></p>
                      )}
                      <button type="button" className="lgame-rewind" onClick={() => choose("plan")}>
                        <RotateCcw size={16} aria-hidden="true" /> Rewind and plan for it
                      </button>
                    </div>
                  )}
                  {choice === "plan" && (
                    <div className="lgame-result lgame-result--plan">
                      <p className="lgame-result__h"><ShieldCheck size={20} aria-hidden="true" /> With a plan</p>
                      <p>{square.withPlan}</p>
                      <p className="lgame-result__docs">
                        <span>Added to your plan:</span>
                        {square.docs?.map((d) => (
                          <Link key={d.key} href={d.href} className="lgame-doc is-in">
                            <Icon name={d.icon} size={16} /> {d.label}
                          </Link>
                        ))}
                      </p>
                      {square.learn && (
                        <p><Link href={square.learn} className="arrow-link">Read more about this <ArrowRight size={16} aria-hidden="true" /></Link></p>
                      )}
                      <details className="lgame-result__without">
                        <summary>What would have happened if it waited?</summary>
                        <p>{square.without}</p>
                      </details>
                    </div>
                  )}
                </>
              )}

              {square.kind === "finish" && (
                <Finish covered={covered} waited={waited} bookHref={bookHref} phone={phone} digits={digits} next={next} senior={senior} onRestart={restart} plannedDocs={[...inPlan]} />
              )}
            </div>

            {square.kind !== "finish" && (
              <div className="lgame-nav">
                {at > 0 && (
                  <button type="button" className="lgame-back" onClick={() => go(at - 1)}>
                    <ArrowLeft size={18} aria-hidden="true" /> Back
                  </button>
                )}
                <button type="button" className="button lgame-move" onClick={() => go(at + 1)} disabled={!canMove}>
                  {at === 0 ? <Dices size={20} aria-hidden="true" /> : null}
                  {at === 0 ? "Start the game" : at + 1 === last ? "See your plan" : "Next square"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                {!canMove && <span className="lgame-nav__hint">Choose one to move on</span>}
              </div>
            )}
          </div>
        </div>

        {/* The plan tray and the protection meter. */}
        <aside className="lgame-tray" aria-label="Your plan so far">
          <p className="lgame-tray__k">Your family&apos;s plan</p>
          <div className="lgame-meter" role="img" aria-label={`${covered} of ${total} what-ifs planned for, ${waited.length} put off`}>
            <div className="lgame-meter__bar">
              {whatifs.map((s) => (
                <span key={s.id} className={`lgame-meter__seg${choices[s.id] === "plan" ? " is-covered" : choices[s.id] === "wait" ? " is-risk" : ""}`} />
              ))}
            </div>
            <p className="lgame-meter__text">
              <strong>{covered} of {total}</strong> what-ifs planned for
              {waited.length > 0 && <span className="lgame-meter__risk"> · {waited.length} left to chance</span>}
            </p>
          </div>
          <ul className="lgame-slots">
            {allDocs.map((d) => {
              const on = inPlan.has(d.key);
              return (
                <li key={d.key} className={`lgame-slot${on ? " is-in" : ""}`}>
                  <span className="lgame-slot__icon">{on ? <Check size={16} aria-hidden="true" /> : <Icon name={d.icon} size={16} />}</span>
                  <span>{d.label}</span>
                  <span className="sr-only">{on ? " (in your plan)" : " (not yet)"}</span>
                </li>
              );
            })}
          </ul>
          <Link href={bookHref} className="lgame-tray__book">
            Make it real: book a call <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>

      {/* Every what-if on one list, for readers who would rather not play. */}
      <details className="lgame-all">
        <summary>Rather read than play? See all {(library ?? whatifs).length} what-ifs on one page</summary>
        <ul>
          {(library ?? whatifs).map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong>
              <p><span className="lgame-all__k lgame-all__k--wait">If it waits:</span> {s.without}</p>
              <p><span className="lgame-all__k lgame-all__k--plan">With a plan:</span> {s.withPlan}{" "}
                {s.docs?.[0] && <Link href={s.docs[0].href}>{s.docs[0].label}</Link>}
                {s.learn && <>{" · "}<Link href={s.learn}>Read more</Link></>}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function finishTitle(covered: number, total: number) {
  if (total === 0) return "Your plan";
  if (covered === total) return "You covered every what-if on the board";
  if (covered === 0) return "Your family is left to chance on every square";
  return `You covered ${covered} of ${total} what-ifs`;
}

function Finish({ covered, waited, bookHref, phone, digits, next, senior, onRestart, plannedDocs }: {
  covered: number; waited: ResolvedSquare[]; bookHref: string; phone: string; digits: string;
  next?: { label: string; href: string }; senior?: boolean; onRestart: () => void; plannedDocs: string[];
}) {
  // Sensitive pages pass /contact and collect nothing, so they get no organizer handoff either.
  const organizer = bookHref !== "/contact";
  const call = (
    <a className={`button${senior ? "" : " secondary"} large`} href={`tel:${digits}`}>
      <Phone size={20} aria-hidden="true" /> Call {phone}
    </a>
  );
  const book = <Link className={`button${senior ? " secondary" : ""} large`} href={bookHref}>Book a call to make it real</Link>;
  return (
    <div className="lgame-finish">
      <p className="lgame-card__text">
        {covered > 0
          ? "This was a game, so nothing is signed yet. A short call with our attorney turns the plan on the right into real documents for your family."
          : "This was only a game. For your real family, a short call is the easiest way to find out which of these apply and what to do first."}
      </p>
      {waited.length > 0 && (
        <div className="lgame-finish__open">
          <p className="lgame-result__h"><CircleAlert size={20} aria-hidden="true" /> Still left to chance</p>
          <ul>{waited.map((s) => <li key={s.id}>{s.title}</li>)}</ul>
        </div>
      )}
      <p className="cta-row lgame-finish__cta">
        {senior ? <>{call}{book}</> : <>{book}{call}</>}
      </p>
      <p className="lgame-finish__small">
        Flat fee, quoted before you sign. No obligation to hire us.
        {next && (
          <>
            {" "}Not ready to talk? <Link href={next.href}>{next.label}</Link>.
          </>
        )}
        {organizer && (
          <>
            {" "}Or <Link href="/my-plan" onClick={() => handOffToPlan({ lifeGameDocs: plannedDocs })}>organize your real family plan</Link> in one place.
          </>
        )}
      </p>
      <button type="button" className="lgame-rewind" onClick={onRestart}>
        <RotateCcw size={16} aria-hidden="true" /> Play again
      </button>
    </div>
  );
}
