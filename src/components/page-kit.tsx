/**
 * The page kit: the blocks every public page carries below its hero, so no page is words alone and
 * every page answers questions and offers a next step.
 *
 *   <TopicDiagram topic="..." />   the diagram that best fits the page (scripts/page-kit.mjs checks for one)
 *   <KitFaqs topic="..." />        questions people ask about this topic, with FAQPage structured data
 *   <KitAnswer answer="..." />     the short answer up top, for answer engines (AnswerBox)
 *   CtaBox (from=...)              the booking prompt, already in components/CtaBox.tsx
 *
 * FAQs are reused from the library and the site FAQ (lib/page-faqs.ts), never written here.
 */
import { FaqList } from "@/components/ui";
import AnswerBox from "@/components/AnswerBox";
import { diagramFor, faqsFor, type FaqTopic } from "@/lib/page-faqs";

export function TopicDiagram({ topic, exclude, fallback }: { topic: string; exclude?: string[]; fallback?: string | null }) {
  const d = diagramFor(topic, { exclude, fallback });
  if (!d) return null;
  const D = d.component;
  return (
    <section className="kit-visual" aria-label={d.title}>
      <D />
    </section>
  );
}

export function KitFaqs({ title = "Questions people ask", ...topic }: FaqTopic & { title?: string }) {
  const faqs = faqsFor(topic);
  if (!faqs.length) return null;
  return (
    <div className="kit-faqs">
      <FaqList faqs={faqs} title={title} />
    </div>
  );
}

export function KitAnswer({ answer, takeaways, label }: { answer: string; takeaways?: string[]; label?: string }) {
  return <AnswerBox answer={answer} takeaways={takeaways} label={label} />;
}

/** The first `n` sentences of a passage, for a short answer drawn from a transcript or intro. */
export function firstSentences(text: string, n = 2): string {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  return parts.slice(0, n).join("").trim();
}
