import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_MODE } from "@/lib/auth/mode";
import { dotnetAuth } from "@/lib/auth/dotnet";
import { REFRESH_COOKIE, clearSessionCookies } from "@/lib/auth/cookies";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));

  if (AUTH_MODE === "dotnet") {
    const rt = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (rt) await dotnetAuth.logout(rt).catch(() => {});
    clearSessionCookies(res);
  }

  //JJQR - AI (Nov 14, 2026)
  res.headers.set("Clear-Site-Data", '"cache", "storage"');
  res.headers.set("Cache-Control", "no-store");
  //JJQR - END

  return res;
}
