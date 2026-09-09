/**
 * Minimal JWT payload decode (NO signature verification).
 *
 * Adequate here because the token only ever reaches us from our own httpOnly
 * cookie, set by our own /api/session/login route over our own origin. Every
 * request that actually uses the token is validated for real by Project02-be
 * (signature + issuer + audience + lifetime). Route gating in proxy.ts just
 * needs the role + expiry.
 *
 * TODO (§17 hardening): verify the HMAC signature with the shared secret
 * (`jose`) before this goes anywhere near production.
 */

export interface DotnetJwtClaims {
  sub: string;
  role?: string;
  email?: string;
  exp?: number;
  [k: string]: unknown;
}

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const NAMEID_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

export function decodeJwt(token: string): DotnetJwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const raw = JSON.parse(json) as Record<string, unknown>;
    return {
      ...raw,
      sub: String(raw.sub ?? raw[NAMEID_CLAIM] ?? ""),
      role: (raw.role ?? raw[ROLE_CLAIM]) as string | undefined,
      email: raw.email as string | undefined,
      exp: raw.exp as number | undefined,
    };
  } catch {
    return null;
  }
}

export function isExpired(claims: DotnetJwtClaims, skewSeconds = 15): boolean {
  if (!claims.exp) return false;
  return Date.now() / 1000 >= claims.exp - skewSeconds;
}
