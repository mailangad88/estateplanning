import { createPhoneLead, type PhoneLeadInput } from "@/server/services/leadDesk";
import { field, formAction } from "./form";

/** "New phone call": a lead typed in by whoever answered the phone. */
export async function POST(request: Request) {
  return formAction(request, "/admin/leads/new", async ({ db, actor, form }) => {
    const opt = (k: string) => field(form, k) || undefined;
    const lead = await createPhoneLead(db, actor, {
      firstName: field(form, "firstName"),
      lastName: field(form, "lastName"),
      phone: field(form, "phone"),
      email: field(form, "email"),
      state: field(form, "state") || "IL",
      county: opt("county"),
      matterType: opt("matterType") as PhoneLeadInput["matterType"],
      urgency: opt("urgency") as PhoneLeadInput["urgency"],
      maritalStatus: opt("maritalStatus") as PhoneLeadInput["maritalStatus"],
      children: opt("children") as PhoneLeadInput["children"],
      ownsHome: opt("ownsHome") as PhoneLeadInput["ownsHome"],
      notes: opt("notes"),
      heardFrom: opt("heardFrom"),
      smsConsent: field(form, "smsConsent") === "yes",
    });
    return { ok: "Phone lead saved. Log the rest of the call below.", to: `/admin/leads/${lead.id}` };
  });
}
