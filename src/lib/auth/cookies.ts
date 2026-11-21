/**
 * httpOnly cookie names + helpers for the .NET JWT session (AUTH_MODE=dotnet).
 * The access token is read server-side (RSC / route handlers / proxy) and
 * forwarded as `Authorization: Bearer` to Project02-be. Never exposed to JS.
 */
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "clinic_at";
export const REFRESH_COOKIE = "clinic_rt";

const isProd = process.env.NODE_ENV === "production";
//JJQR - AI (Nov 21, 2026) - the desktop "clinic node" serves the UI over plain http://localhost; Safari/WebKit (the Mac window) refuses `Secure` cookies over http, so login would silently fail there.
// Only the desktop app sets CLINIC_LOCAL_NODE=1; the hosted site stays Secure-only.
export const COOKIE_SECURE = isProd && process.env.CLINIC_LOCAL_NODE !== "1";
//JJQR - END

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: COOKIE_SECURE,
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
