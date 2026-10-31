import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { MAGNET_FORMATS, getMagnet } from "@/lib/magnets";
import { getQuiz, getQuizzes, maxPoints } from "@/lib/quizzes";
import { breadcrumbLd, JsonLd } from "@/lib/seo";
import QuizRunner from "./QuizRunner";
import CtaBox from "@/components/CtaBox";
import { KitAnswer, KitFaqs, TopicDiagram } from "@/components/page-kit";

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
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/quizzes", label: "Quizzes" }, { label: q.title }]} />}
        kicker="Quiz"
        path={`/quizzes/${q.slug}`}
        title={q.title}
        lead={q.promise}
      />
      <KitAnswer answer={q.description} label="What this quiz checks" />
      <QuizRunner
        quiz={{ slug: q.slug, kind: q.kind, questions: q.questions, bands: q.bands, max: maxPoints(q) }}
        magnet={m ? { slug: m.slug, title: m.title, format: m.format, formatLabel: MAGNET_FORMATS[m.format], tag: m.tag, sequence: m.sequence } : null}
      />
      <TopicDiagram topic={`${q.title} ${q.slug} ${q.description}`} />
      <KitFaqs url={`/quizzes/${q.slug}`} topic={q.title.replace(/\b(quiz|check|readiness|iq)\b/gi, "")} context={q.description} categories={["Getting started"]} />
      <CtaBox from={`quiz-${q.slug}`} />
      <ReviewNote reviewed={q.reviewed} updated={q.updated} />
      <p className="notice">General information, not legal advice. Laws differ by state.</p>
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Quizzes", path: "/quizzes" }, { name: q.title, path: `/quizzes/${q.slug}` }])]} />
    </article>
  );
}
