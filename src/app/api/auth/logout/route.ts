import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/portal", request.url), 303);
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
