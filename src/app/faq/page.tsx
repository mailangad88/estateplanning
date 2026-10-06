import type { Metadata } from "next";
import { getFaqs } from "@/lib/content";
import { Cta, FaqList, PageHeader } from "@/components/ui";

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
      <PageHeader title="Frequently asked questions" lead="Straight answers to the questions we hear most." />
      {cats.map((c) => (
        <FaqList key={c} title={c} faqs={faqs.filter((f) => f.category === c)} />
      ))}
      <Cta />
    </>
  );
}
