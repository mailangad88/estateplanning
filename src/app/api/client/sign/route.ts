import { z } from "zod";
import { BuiltinEsignProvider, builtinSecret } from "@/server/esign/builtin";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { readJson, withActor } from "@/server/http";
import { notifierFromEnv, type Notifier } from "@/server/notify";
import { deviceFromRequest } from "@/server/services/planAccount";
import { signEngagement } from "@/server/services/signing";

const Sign = z.object({
  engagementId: z.string().min(1).max(100),
  signerRole: z.enum(["client", "spouse"]),
  typedName: z.string().max(200),
  consent: z.boolean(),
  intent: z.boolean(),
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
});

function optional<T>(make: () => T): T | undefined {
  try {
    return make();
  } catch {
    return undefined; // a signature is never lost over a payments or alert setting; the cron sweep catches up
  }
}

/** The client signs on /client/sign/[engagementId]. Only the IP prefix and a device summary are kept. */
export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const input = Sign.parse(await readJson(request));
    const notifier: Notifier | undefined = optional(() => notifierFromEnv());
    const r = await signEngagement(
      db,
      actor,
      { ...input, device: deviceFromRequest(request) },
      new BuiltinEsignProvider(builtinSecret()),
      { payments: optional(() => paymentProviderFromEnv()), notifier },
    );
    return { complete: r.complete, signedAt: r.signature.signedAt };
  });
}
