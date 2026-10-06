import type { Faq } from "@/lib/content";

/** Visible FAQ list. FAQPage structured data must match content shown on the page. */
export default function Faqs({ faqs }: { faqs: Faq[] }) {
  if (!faqs.length) return null;
  return (
    <section className="faqs" aria-labelledby="faqs">
      <h2 id="faqs">Frequently asked questions</h2>
      {faqs.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}
