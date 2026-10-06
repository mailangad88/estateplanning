import Link from "next/link";
import { firm } from "@/config/firm";

/** Lead capture prompt shown on content pages. Wording must stay educational and pressure-free. */
export default function CtaBox({ topic }: { topic?: string }) {
  return (
    <aside className="cta-box" aria-label="Get help">
      <p className="cta-title">{topic ? `Questions about ${topic.toLowerCase()}?` : "Not sure where to start?"}</p>
      <p>
        Answer a few questions in about two minutes and see what people in your situation usually talk through with an
        attorney. If you want, you can then book a call with our team.
      </p>
      <p className="cta-actions">
        <Link className="button" href="/plan-finder">Start the plan finder</Link>
        <a className="button secondary" href={`tel:${firm.phone.replace(/\D/g, "")}`}>Call {firm.phone}</a>
      </p>
    </aside>
  );
}
