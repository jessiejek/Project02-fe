import { NextResponse } from "next/server";
import { AUTH_MODE } from "@/lib/auth/mode";
import { dotnetAuth } from "@/lib/auth/dotnet";
import { setSessionCookies } from "@/lib/auth/cookies";
import { createClient } from "@/lib/supabase/server";

/**
 * AUTH_MODE=dotnet login. Authenticates against Project02-be, stores the JWT
 * pair in httpOnly cookies, and best-effort establishes a parallel Supabase
 * session so not-yet-migrated `.from(...)` calls keep working (Phase 1 crutch).
 *
 * Body:  { email, password }
 * 200:   { role, supabaseLinked }
 * 401:   { error }
 */
export async function POST(request: Request) {
  if (AUTH_MODE !== "dotnet") {
    return NextResponse.json({ error: "dotnet auth mode is not enabled." }, { status: 400 });
  }

  const { email, password } = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const result = await dotnetAuth.login(email.trim(), password);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 401 ? "Incorrect email or password." : result.message },
      { status: result.status || 502 },
    );
  }

  const { accessToken, refreshToken, user } = result.data;

  // Parallel Supabase session — compatibility only, never the source of truth.
  let supabaseLinked = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    supabaseLinked = !error;
  } catch {
    supabaseLinked = false;
  }

  const res = NextResponse.json({ role: user.role, supabaseLinked });
  setSessionCookies(res, accessToken, refreshToken);
  return res;
}
