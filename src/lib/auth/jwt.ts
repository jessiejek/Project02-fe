/**
 * JWT helpers for the .NET access token (clinic_at cookie).
 *
 * Production path verifies HMAC-SHA256 with the shared secret (same as
 * Project02-be Jwt:Secret), plus issuer + audience. Unsigned / tampered /
 * wrong-secret tokens are rejected at the proxy and session layer.
 *
 * Secret is server-only: JWT_SECRET (or DOTNET_JWT_SECRET). Never NEXT_PUBLIC_*.
 */

import { jwtVerify } from "jose";

export interface DotnetJwtClaims {
  sub: string;
  role?: string;
  email?: string;
  exp?: number;
  [k: string]: unknown;
}

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const NAMEID_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

function signingKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET ?? process.env.DOTNET_JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function issuer(): string {
  return process.env.JWT_ISSUER ?? "ClinicApp";
}

function audience(): string {
  return process.env.JWT_AUDIENCE ?? "ClinicApp";
}

function normalizeClaims(payload: Record<string, unknown>): DotnetJwtClaims {
  return {
    ...payload,
    sub: String(payload.sub ?? payload[NAMEID_CLAIM] ?? ""),
    role: (payload.role ?? payload[ROLE_CLAIM]) as string | undefined,
    email: payload.email as string | undefined,
    exp: payload.exp as number | undefined,
  };
}

/**
 * Unsafe payload peek (no signature check). Used only to decide whether an
 * expired-but-well-formed token should trigger silent refresh. Never trust
 * role/sub from this for gating — use verifyJwt for that.
 */
export function decodeJwt(token: string): DotnetJwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const raw = JSON.parse(json) as Record<string, unknown>;
    return normalizeClaims(raw);
  } catch {
    return null;
  }
}

/** Verify HMAC + iss + aud + exp. Null on any failure (incl. missing secret). */
export async function verifyJwt(token: string): Promise<DotnetJwtClaims | null> {
  const key = signingKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: issuer(),
      audience: audience(),
      algorithms: ["HS256"],
      clockTolerance: 30,
    });
    const claims = normalizeClaims(payload as Record<string, unknown>);
    if (!claims.sub) return null;
    return claims;
  } catch {
    return null;
  }
}

export function isExpired(claims: DotnetJwtClaims, skewSeconds = 15): boolean {
  if (!claims.exp) return false;
  return Date.now() / 1000 >= claims.exp - skewSeconds;
}
