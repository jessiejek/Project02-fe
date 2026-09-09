import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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

  // Also end the parallel Supabase session (both modes — harmless if absent).
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* no session */
  }

  return res;
}
