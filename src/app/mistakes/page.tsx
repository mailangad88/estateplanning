import type { Metadata } from "next";
import { getMistakes } from "@/lib/content";
import { Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Common estate planning mistakes and how families avoid them",
  description: "The estate planning mistakes that cause the most trouble for families, and what people do instead.",
  alternates: { canonical: "/mistakes" },
};

export default function MistakesPage() {
  const mistakes = getMistakes();
  const cats = [...new Set(mistakes.map((m) => m.category))];
  return (
    <>
      <PageHeader kicker="Mistakes to avoid" art="HeroProbate" title={`${mistakes.length} estate planning mistakes to avoid`} lead="Each one is common, and each one has a simple fix if it is caught early." />
      {cats.map((c) => (
        <section key={c}>
          <h2>{c}</h2>
          {mistakes.filter((m) => m.category === c).map((m) => (
            <div className="card" key={m.title} style={{ marginBottom: 12 }}>
              <strong>{m.title}</strong>
              <p style={{ margin: "6px 0" }}><em>What goes wrong:</em> {m.why}</p>
              <p style={{ margin: 0 }}><em>What people do instead:</em> {m.fix}</p>
            </div>
          ))}
        </section>
      ))}
      <Cta title="Not sure if your plan has one of these?" body="Answer a few questions and an attorney can review your existing documents with you." />
    </>
  );
}
