import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLessons } from "@/lib/content";
import { Breadcrumbs, Prose, ReviewNote } from "@/components/ui";
import { EmailCapture } from "@/components/capture";

type Props = { params: Promise<{ day: string }> };

export function generateStaticParams() {
  return getLessons().map((l) => ({ day: String(l.day) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params;
  const l = getLessons().find((x) => String(x.day) === day);
  if (!l) return {};
  return { title: l.title, description: l.description, alternates: { canonical: `/course/${l.day}` } };
}

export default async function LessonPage({ params }: Props) {
  const { day } = await params;
  const lessons = getLessons();
  const l = lessons.find((x) => String(x.day) === day);
  if (!l) notFound();
  const next = lessons.find((x) => x.day === l.day + 1);
  return (
    <article>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/course", label: "7-day course" }, { label: `Day ${l.day}` }]} />
      <h1>{l.title}</h1>
      <ReviewNote reviewed={l.reviewed} updated={l.updated} />
      {l.task && <div className="answer"><strong>Today&apos;s task</strong>{l.task}</div>}
      <Prose html={l.html} />
      {next ? (
        <p><Link className="button" href={`/course/${next.day}`}>Next: {next.title}</Link></p>
      ) : (
        <p><Link className="button" href="/plan-finder">Book your consult</Link></p>
      )}
      <EmailCapture kind="course" interest="7-day-course" title="Get the lessons by email instead" cta="Email me the course" success="You're in. Lesson 1 is on its way." />
    </article>
  );
}
