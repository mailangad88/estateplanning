import { NextResponse } from "next/server";
import { beginLogin } from "@/server/auth/flow";
import { getDb } from "@/server/runtime";

/** Same response whether or not the address has an account. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "");
  await beginLogin(await getDb(), email);
  return NextResponse.redirect(new URL("/portal/login?sent=1", request.url), 303);
}
