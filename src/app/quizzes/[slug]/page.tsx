import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, ReviewNote } from "@/components/ui";
import { MAGNET_FORMATS, getMagnet } from "@/lib/magnets";
import { getQuiz, getQuizzes, maxPoints } from "@/lib/quizzes";
import { breadcrumbLd, JsonLd } from "@/lib/seo";
import QuizRunner from "./QuizRunner";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getQuizzes().map((q) => ({ slug: q.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const q = getQuiz((await params).slug);
  if (!q) return {};
  return { title: q.title, description: q.description, alternates: { canonical: `/quizzes/${q.slug}` } };
}

export default async function QuizPage({ params }: Props) {
  const q = getQuiz((await params).slug);
  if (!q) notFound();
  const m = getMagnet(q.magnet);
  return (
    <article>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/quizzes", label: "Quizzes" }, { label: q.title }]} />
      <h1>{q.title}</h1>
      <p className="lead">{q.promise}</p>
      <QuizRunner
        quiz={{ slug: q.slug, kind: q.kind, questions: q.questions, bands: q.bands, max: maxPoints(q) }}
        magnet={m ? { slug: m.slug, title: m.title, format: m.format, formatLabel: MAGNET_FORMATS[m.format], tag: m.tag, sequence: m.sequence } : null}
      />
      <ReviewNote reviewed={q.reviewed} updated={q.updated} />
      <p className="notice">General information, not legal advice. Laws differ by state.</p>
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Quizzes", path: "/quizzes" }, { name: q.title, path: `/quizzes/${q.slug}` }])]} />
    </article>
  );
}
