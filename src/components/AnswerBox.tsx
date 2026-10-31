/** The short, quotable answer at the top of a page (answer engine optimization). */
export default function AnswerBox({ answer, takeaways, label = "The short answer" }: { answer: string; takeaways?: string[]; label?: string }) {
  if (!answer && !takeaways?.length) return null;
  return (
    <section className="answer-box" aria-label="Short answer">
      {answer && (
        <>
          <h2 className="answer-label">{label}</h2>
          <p className="answer">{answer}</p>
        </>
      )}
      {takeaways && takeaways.length > 0 && (
        <ul className="takeaways">
          {takeaways.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
