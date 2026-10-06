import { firm } from "@/config/firm";

export const metadata = { title: "How we work" };

// DRAFT: must be reviewed and approved by the attorney before launch.
export default function Page() {
  return (
    <>
      <h1>How we work</h1>
      <p className="notice">Draft pending attorney review.</p>
      <p>{firm.brandName} is the marketing and intake team of {firm.firmLegalName}. When you reach out, a member of our intake team, who is not a lawyer, gathers basic information and schedules a consult with an attorney at the firm.</p>
      <p>Before any confidential details are shared, the firm runs a conflict check. The attorney will give you a flat-fee quote before you decide whether to hire the firm.</p>
    </>
  );
}
