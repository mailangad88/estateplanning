import fs from "node:fs";
import path from "node:path";

/** Interactive quizzes in content/quizzes (format in content/quizzes/README.md). */

export interface QuizOption {
  label: string;
  points: number;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  explanation: string;
}

export interface QuizBand {
  min: number;
  max: number;
  label: string;
  summary: string;
}

export interface Quiz {
  slug: string;
  title: string;
  promise: string;
  description: string;
  kind: "knowledge" | "assessment";
  category: string;
  magnet: string;
  related: string[];
  reviewed: boolean;
  updated: string;
  questions: QuizQuestion[];
  bands: QuizBand[];
}

const DIR = path.join(process.cwd(), "content", "quizzes");
let cache: Quiz[] | null = null;

export function getQuizzes(): Quiz[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  if (!fs.existsSync(DIR)) return [];
  cache = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      // Strip editorial "<!-- verify -->" markers so they never show on the page.
      const raw = fs.readFileSync(path.join(DIR, f), "utf8").replace(/\s*<!--.*?-->/g, "");
      const q = JSON.parse(raw) as Omit<Quiz, "slug">;
      return { ...q, slug: f.replace(/\.json$/, ""), related: q.related ?? [], reviewed: q.reviewed === true };
    });
  return cache;
}

export function getQuiz(slug: string): Quiz | undefined {
  return getQuizzes().find((q) => q.slug === slug);
}

export function maxPoints(q: Pick<Quiz, "questions">): number {
  return q.questions.reduce((sum, x) => sum + Math.max(...x.options.map((o) => o.points)), 0);
}

export function bandFor(q: Pick<Quiz, "bands">, total: number): QuizBand | undefined {
  return q.bands.find((b) => total >= b.min && total <= b.max);
}
