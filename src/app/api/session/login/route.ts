import { NextResponse } from "next/server";
import { dotnetAuth } from "@/lib/auth/dotnet";
import { setSessionCookies } from "@/lib/auth/cookies";

/**
 * Login against Project02-be: authenticates, stores the JWT pair in httpOnly
 * cookies, returns the role so the client can route to the right portal.
 *
 * Body:  { email, password }
 * 200:   { role }
 * 401:   { error }
 */
export async function POST(request: Request) {
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
  const res = NextResponse.json({ role: user.role });
  setSessionCookies(res, accessToken, refreshToken);
  return res;
}
