import { servedStates } from "@/config/firm";
import { rulesFor } from "@/config/compliance";
import { displayableTestimonials, testimonials, type Testimonial } from "@/config/reviews";

/**
 * Client testimonials (B17). Renders nothing when there are no real, consented testimonials
 * (the list is empty at launch). Each quote carries every disclaimer required by the states
 * the firm serves. Emits no Review or AggregateRating markup.
 */
export function Testimonials({ items = testimonials, states = servedStates() }: { items?: Testimonial[]; states?: string[] }) {
  const shown = displayableTestimonials(items);
  if (shown.length === 0) return null;
  const disclaimers = rulesFor(states).testimonialDisclaimers;
  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <h2 id="testimonials-title">What some clients have said</h2>
      <ul>
        {shown.map((t) => (
          <li key={t.id}>
            <blockquote>{t.quote}</blockquote>
            <p className="meta">
              {t.attribution}, {t.source}, {t.date}
            </p>
            <p className="notice">{disclaimers.join(" ")}</p>
          </li>
        ))}
      </ul>
      <p className="notice">
        These are selected comments shared with permission. No one was paid or offered anything for them. {disclaimers.join(" ")}
      </p>
    </section>
  );
}
