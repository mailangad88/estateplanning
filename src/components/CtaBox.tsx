import BookCta from "@/components/BookCta";

/** Lead capture prompt shown on library pages. Wording must stay educational and pressure-free. */
export default function CtaBox({ topic }: { topic?: string }) {
  return (
    <BookCta
      from="cta-box"
      title={topic ? `Questions about ${topic.toLowerCase()}?` : "Not sure where to start?"}
    />
  );
}
