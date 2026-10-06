import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free estate planning tools",
  description: "A readiness score, a probate cost estimate and a will-or-trust helper. Free, educational and quick.",
};

const TOOLS = [
  {
    href: "/tools/readiness",
    title: "Estate plan readiness score",
    body: "Ten quick questions. See how organized your planning is and where the gaps usually are.",
    time: "About 2 minutes",
  },
  {
    href: "/tools/probate-cost",
    title: "Probate cost estimator",
    body: "A rough range of what probate can cost and how long it can take, based on general figures for your state.",
    time: "About 1 minute",
  },
  {
    href: "/tools/will-or-trust",
    title: "Will or trust?",
    body: "See which factors people weigh when choosing between a will and a living trust, and which way your answers point.",
    time: "About 2 minutes",
  },
  {
    href: "/plan-finder",
    title: "Plan finder",
    body: "Answer a few questions about your family and see the topics people in your situation usually discuss with an attorney.",
    time: "About 2 minutes",
  },
];

export default function ToolsPage() {
  return (
    <>
      <h1>Free estate planning tools</h1>
      <p className="lead">Quick, private and educational. You see your result before we ask for anything.</p>
      <ul className="card-grid">
        {TOOLS.map((t) => (
          <li className="card" key={t.href}>
            <strong>{t.title}</strong>
            <p>{t.body}</p>
            <p className="notice">{t.time}</p>
            <Link className="button small" href={t.href}>Start</Link>
          </li>
        ))}
      </ul>
      <p className="notice">These tools give general information, not legal advice about your situation.</p>
    </>
  );
}
