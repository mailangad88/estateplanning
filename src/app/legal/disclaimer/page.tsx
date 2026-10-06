import { firm } from "@/config/firm";

export const metadata = { title: "Disclaimer" };

// DRAFT: must be reviewed and approved by the attorney before launch.
export default function Page() {
  return (
    <>
      <h1>Disclaimer</h1>
      <p className="notice">Draft pending attorney review.</p>
      <p>This website is attorney advertising. The content is general information and is not legal advice. Laws differ by state and change over time.</p>
      <p>Using this website, completing the plan finder, or contacting us does not create an attorney-client relationship. That relationship begins only when you and the firm sign an engagement agreement.</p>
      <p>Responsible attorney: {firm.attorneyName}, bar number {firm.barNumber}.</p>
    </>
  );
}
