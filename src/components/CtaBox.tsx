import BookCta from "@/components/BookCta";

/** Lead capture prompt shown on library pages. Wording must stay educational and pressure-free. */
export default function CtaBox({ topic, from = "cta-box" }: { topic?: string; from?: string }) {
  return (
    <BookCta
      from={from}
      title={topic ? `Questions about ${topic.toLowerCase()}?` : "Not sure where to start?"}
    />
  );
}
