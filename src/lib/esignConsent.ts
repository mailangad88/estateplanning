/**
 * The consumer disclosure shown before a client agrees to sign electronically (ESIGN Act, 15 U.S.C. 7001(c)).
 * It says, in plain words: what the consent covers, that paper is available and how to get it, how to withdraw
 * consent and what that means, how to keep contact details current, and what is needed to open and keep the
 * record. Every signature stores the version the signer agreed to, so change the version whenever the text
 * changes. The firm should have its attorney review this wording before launch.
 */
import { firm } from "@/config/firm";

export const ESIGN_CONSENT_VERSION = "esign-consent-2026-10-v1";

export const ESIGN_CONSENT_CHECKBOX = "I agree to use electronic records and signatures for this agreement.";

export const ESIGN_INTENT_CHECKBOX = "I intend to sign this agreement with the name I typed.";

export function esignDisclosure(firmName = firm.firmLegalName, phone = firm.phone): { heading: string; points: string[] } {
  return {
    heading: "Signing electronically",
    points: [
      `This consent covers this engagement agreement with ${firmName} and the notices about it. You are not required to sign electronically.`,
      `You can have a paper copy at any time, free of charge. Ask by calling ${phone} or by sending a message from your case page, and the office will mail or hand one to you. You can also print or save the signed copy from this site.`,
      `You can withdraw this consent before or after you sign by calling ${phone} or sending a message from your case page. Withdrawing does not undo a signature you already made; it means the office will send future papers about this agreement on paper. If you withdraw before you sign, the office will give you a paper agreement to sign instead.`,
      "Please keep your email address and phone number up to date with the office, so notices reach you.",
      "To view and keep this agreement you need a current web browser (any recent version of Safari, Chrome, Edge or Firefox) and a way to print it or save it as a file. If an attached PDF will not open on your device, ask for a paper copy.",
    ],
  };
}
