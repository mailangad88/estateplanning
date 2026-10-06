import { NextResponse } from "next/server";
import { finishLink, preauthCookie } from "@/server/auth/flow";
import { getDb } from "@/server/runtime";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const pre = await finishLink(await getDb(), token);
  if (!pre) return NextResponse.redirect(new URL("/portal/login?expired=1", request.url), 303);
  const res = NextResponse.redirect(new URL("/portal/login/verify", request.url), 303);
  res.headers.append("set-cookie", preauthCookie(pre));
  return res;
}
