import { absoluteUrl, site } from "@/config/site";
import { getFaqs } from "@/lib/content";
import { getAllArticles, getStateGuides } from "@/lib/library";

export const dynamic = "force-static";

/** Every answered question on the site with the page it comes from (listed in llms.txt). */
export function GET() {
  const questions = [
    ...getFaqs().map((f) => ({ question: f.q, answer: f.a, topic: f.category, url: absoluteUrl("/faq") })),
    ...[...getAllArticles(), ...getStateGuides()].flatMap((p) =>
      p.faqs.map((f) => ({ question: f.q, answer: f.a, topic: p.title, url: absoluteUrl(p.url) })),
    ),
  ];
  return Response.json({
    name: "Estate planning questions and answers",
    status: site.reviewStatus,
    note: "General information, not legal advice. Laws vary by state.",
    count: questions.length,
    questions,
  });
}
