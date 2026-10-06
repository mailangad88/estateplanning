import { firm } from "@/config/firm";

export const metadata = { title: "Text message terms" };

// DRAFT: must be reviewed and approved by the attorney before launch.
export default function Page() {
  return (
    <>
      <h1>Text message terms</h1>
      <p className="notice">Draft pending attorney review.</p>
      <p>If you agree to receive text messages, {firm.firmLegalName} may text you about your inquiry, appointments and estate planning. Message frequency varies. Message and data rates may apply.</p>
      <p>Reply STOP to stop receiving messages at any time. Reply HELP for help, or call {firm.phone}. Consent to receive texts is not required to use our services.</p>
      <p>We never put sensitive details about your family, health or finances in a text message.</p>
    </>
  );
}
