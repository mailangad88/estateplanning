import type { Metadata } from "next";
import { getFaqs } from "@/lib/content";
import { Cta, FaqList, PageHeader } from "@/components/ui";
import { TopicDiagram } from "@/components/page-kit";

export const metadata: Metadata = {
  title: "Estate planning FAQ",
  description: "Answers to the questions people ask before they make a will or trust, and after a family member dies.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const faqs = getFaqs();
  const cats = [...new Set(faqs.map((f) => f.category))];
  return (
    <>
      <PageHeader kicker="FAQ" art="SpotQuestions" title="Frequently asked questions" lead="Straight answers to the questions we hear most." />
      {cats.map((c, i) => (
        <div key={c}>
          <FaqList title={c} faqs={faqs.filter((f) => f.category === c)} />
          {i === 0 && <TopicDiagram topic="planning process step by step" />}
          {c === "Wills" && <TopicDiagram topic="will vs trust" />}
          {c === "Incapacity" && <TopicDiagram topic="power-of-attorney healthcare" />}
          {c === "After a death" && <TopicDiagram topic="probate timeline" />}
        </div>
      ))}
      <Cta from="faq" />
    </>
  );
}
