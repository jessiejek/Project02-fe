import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_MODE } from "@/lib/auth/mode";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { decodeJwt, isExpired } from "@/lib/auth/jwt";

/**
 * Same-origin only. Hands the current .NET access token to client components so
 * they can call protected Project02-be endpoints. The token itself stays in an
 * httpOnly cookie at rest; proxy.ts refreshes it. 401 if there's no valid token
 * (the browser client then knows the session is gone).
 */
export async function GET() {
  if (AUTH_MODE !== "dotnet") {
    return NextResponse.json({ error: "not in dotnet auth mode" }, { status: 400 });
  }
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const claims = token ? decodeJwt(token) : null;
  if (!token || !claims || isExpired(claims)) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
