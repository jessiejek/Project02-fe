import "server-only";
import { cookies } from "next/headers";
import { AUTH_MODE } from "./mode";
import { ACCESS_COOKIE } from "./cookies";
import { decodeJwt, isExpired } from "./jwt";
import { API_BASE_URL } from "@/lib/api/client";
import type { SessionInfo } from "./types";

export type { SessionInfo };

/**
 * Resolve the current session on the server (RSC / route handlers).
 *
 * AUTH_MODE=supabase → returns null; the client SessionProvider loads it itself.
 * AUTH_MODE=dotnet   → everything comes from the .NET JWT cookie + the .NET
 *                      `/me` endpoints (patients / staff-accounts). Token refresh
 *                      happens in proxy.ts.
 */
export async function getServerSession(): Promise<SessionInfo | null> {
  if (AUTH_MODE !== "dotnet") return null;

  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = decodeJwt(token);
  if (!claims?.sub || !claims.role || isExpired(claims)) return null;

  const role = claims.role as SessionInfo["role"];
  const userId = claims.sub;

  async function me<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }

  if (role === "Patient") {
    const p = await me<{ patient_id: string; first_name: string; last_name: string }>("/api/patients/me");
    return {
      userId,
      role,
      displayName: p ? `${p.first_name} ${p.last_name}` : (claims.email ?? "Patient"),
      avatarUrl: null,
      staffId: null,
      patientId: p?.patient_id ?? null,
    };
  }

  const s = await me<{ staff_id: string; full_name: string; avatar_url: string | null }>("/api/staff-accounts/me");
  return {
    userId,
    role,
    displayName: s?.full_name ?? claims.email ?? role,
    avatarUrl: s?.avatar_url ?? null,
    staffId: s?.staff_id ?? null,
    patientId: null,
  };
}
