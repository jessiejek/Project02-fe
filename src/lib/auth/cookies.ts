/**
 * httpOnly cookie names + helpers for the .NET JWT session (AUTH_MODE=dotnet).
 * The access token is read server-side (RSC / route handlers / proxy) and
 * forwarded as `Authorization: Bearer` to Project02-be. Never exposed to JS.
 */
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "clinic_at";
export const REFRESH_COOKIE = "clinic_rt";

const isProd = process.env.NODE_ENV === "production";

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

/** ~access-token lifetime; refresh cookie outlives it so proxy can silently renew. */
const ACCESS_MAX_AGE = 60 * 60; // 1h — matches Jwt:AccessTokenExpiryMinutes
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7d — matches Jwt:RefreshTokenExpiryDays

export function setSessionCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}
