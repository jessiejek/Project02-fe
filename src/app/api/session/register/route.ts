import { NextResponse } from "next/server";
import { dotnetAuth } from "@/lib/auth/dotnet";
import { setSessionCookies } from "@/lib/auth/cookies";

/**
 * Self-registration against Project02-be: creates a Patient-role account,
 * authenticates immediately, stores the JWT pair in httpOnly cookies.
 *
 * Body:  { firstName, middleName?, lastName, email, password, dateOfBirth, sex, contactNumber? }
 * 200:   { role }
 * 409:   { error }  — email already registered
 * 400:   { error }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    dateOfBirth?: string;
    sex?: string;
    contactNumber?: string;
  };

  const { firstName, lastName, email, password } = body;
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "First name, last name, email, and password are required." }, { status: 400 });
  }
  if (!body.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) {
    return NextResponse.json({ error: "Date of birth is required." }, { status: 400 });
  }
  if (body.sex !== "Male" && body.sex !== "Female") {
    return NextResponse.json({ error: "Please select your sex." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const result = await dotnetAuth.register({
    firstName: firstName.trim(),
    middleName: body.middleName?.trim() || undefined,
    lastName: lastName.trim(),
    email: email.trim(),
    password,
    dateOfBirth: body.dateOfBirth,
    sex: body.sex,
    contactNumber: body.contactNumber?.trim() || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 409 ? "An account with this email already exists." : result.message },
      { status: result.status || 502 },
    );
  }

  const { accessToken, refreshToken, user } = result.data;
  const res = NextResponse.json({ role: user.role });
  setSessionCookies(res, accessToken, refreshToken);
  return res;
}
