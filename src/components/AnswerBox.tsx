/** The short, quotable answer at the top of a page (answer engine optimization). */
export default function AnswerBox({ answer, takeaways }: { answer: string; takeaways?: string[] }) {
  if (!answer && !takeaways?.length) return null;
  return (
    <section className="answer-box" aria-label="Short answer">
      {answer && (
        <>
          <h2 className="answer-label">The short answer</h2>
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
