import { RELEASE_STATUSES, type ReleaseStatus } from "@/lib/partners";
import { readJson, withActor } from "@/server/http";
import { answerValueQuestion, setDisclosureGiven, setReleaseStatus } from "@/server/services/partners";

/** One referral: record the disclosure, move the release, or answer "is anything of value linked?". */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<Record<string, unknown>>(request);
    let referral;
    if (typeof body.disclosureGiven === "boolean") referral = await setDisclosureGiven(db, actor, id, body.disclosureGiven);
    if (typeof body.release === "string") {
      if (!RELEASE_STATUSES.includes(body.release as ReleaseStatus)) throw new Error("Unknown release status");
      referral = await setReleaseStatus(db, actor, id, body.release as ReleaseStatus);
    }
    if (typeof body.valueLinked === "boolean") {
      referral = await answerValueQuestion(db, actor, id, body.valueLinked, typeof body.valueNote === "string" ? body.valueNote : undefined);
    }
    if (!referral) throw new Error("Nothing to update");
    return { referral };
  }, { scopedWrites: true });
}
