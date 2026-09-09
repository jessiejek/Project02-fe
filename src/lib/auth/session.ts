import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AUTH_MODE } from "./mode";
import { ACCESS_COOKIE } from "./cookies";
import { decodeJwt, isExpired } from "./jwt";
import type { SessionInfo } from "./types";

export type { SessionInfo };

/**
 * Resolve the current session on the server (RSC / route handlers).
 *
 * AUTH_MODE=supabase → returns null; the client SessionProvider loads it itself
 *                      (unchanged behaviour).
 * AUTH_MODE=dotnet   → identity + role come from the .NET JWT cookie; the
 *                      resource ids (patientId/staffId) and display name are
 *                      still resolved from Supabase, keyed by the shared user
 *                      UUID, until those resources migrate (Phase 2+). Token
 *                      refresh happens in proxy.ts, which can write cookies.
 */
export async function getServerSession(): Promise<SessionInfo | null> {
  if (AUTH_MODE !== "dotnet") return null;

  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = decodeJwt(token);
  if (!claims?.sub || !claims.role || isExpired(claims)) return null;

  const role = claims.role as SessionInfo["role"];
  const userId = claims.sub;

  const supabase = await createClient();

  if (role === "Patient") {
    const { data: patient } = await supabase
      .from("patients")
      .select("patient_id, first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      userId,
      role,
      displayName: patient ? `${patient.first_name} ${patient.last_name}` : (claims.email ?? "Patient"),
      avatarUrl: null,
      staffId: null,
      patientId: patient?.patient_id ?? null,
    };
  }

  const { data: staff } = await supabase
    .from("staff_accounts")
    .select("staff_id, full_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    userId,
    role,
    displayName: staff?.full_name ?? claims.email ?? role,
    avatarUrl: staff?.avatar_url ?? null,
    staffId: staff?.staff_id ?? null,
    patientId: null,
  };
}
