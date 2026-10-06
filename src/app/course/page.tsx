import type { Metadata } from "next";
import Link from "next/link";
import { getLessons } from "@/lib/content";
import { PageHeader } from "@/components/ui";
import { EmailCapture } from "@/components/capture";

export const metadata: Metadata = {
  title: "Free course: your estate plan in 7 days",
  description: "Seven short lessons, one small task a day, so you walk into your consult ready.",
  alternates: { canonical: "/course" },
};

export default function CourseIndex() {
  const lessons = getLessons();
  return (
    <>
      <PageHeader kicker="Free email course" art="SpotCalendarReview" title="Your estate plan in 7 days" lead="A free email course. One short lesson and one small task a day, so you arrive at a consult with everything ready and nothing to figure out on the spot." />
      <EmailCapture kind="course" interest="7-day-course" title="Start the free course" body="Lesson 1 arrives today, then one a day for a week." cta="Start the course" success="You're in. Lesson 1 is on its way." />
      <h2>What you will cover</h2>
      <ol>
        {lessons.map((l) => (
          <li key={l.slug}>
            <Link href={`/course/${l.day}`}>{l.title}</Link>
            {l.task && <p className="notice" style={{ margin: "2px 0 10px" }}>Task: {l.task}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
