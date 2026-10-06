import type { Metadata } from "next";
import { CardGrid, PageHeader } from "@/components/ui";
import { getQuizzes } from "@/lib/quizzes";

export const metadata: Metadata = {
  title: "Estate planning quizzes",
  description: "Quick quizzes on wills, trusts, probate and family protection. See your score right away.",
  alternates: { canonical: "/quizzes" },
};

export default function Quizzes() {
  const quizzes = getQuizzes();
  return (
    <>
      <PageHeader title="Quizzes" lead="A few minutes each. See your score right away, and get the full answer review by email." />
      <CardGrid items={quizzes.map((q) => ({ href: `/quizzes/${q.slug}`, title: q.title, description: q.promise, tag: `${q.questions.length} questions` }))} />
    </>
  );
}
