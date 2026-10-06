import { firm } from "@/config/firm";
import { assertCan, can } from "@/server/auth/policy";
import { currentRuleVersions, ruleHistory, saveFeeRule, type FeeRuleInput } from "@/server/fees/admin";
import { readJson, withActor } from "@/server/http";

export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    assertCan(can(actor, "manage_fee_rules"));
    return {
      structure: firm.structure,
      rules: await Promise.all((await currentRuleVersions(db)).map(async (v) => ({ ...v, history: await ruleHistory(db, v.ruleId) }))),
    };
  });
}

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const { rule, reason } = await readJson<{ rule: FeeRuleInput; reason: string }>(request);
    return await saveFeeRule(db, actor, rule, String(reason ?? ""), firm.structure);
  }, { scopedWrites: true });
}
