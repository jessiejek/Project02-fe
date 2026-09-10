/**
 * Signed-in account self-service (§ Phase 1b auth cutover).
 * These replace the old `supabase.auth.signInWithPassword` + `updateUser` /
 * `resend` calls in the profile pages and the patient dashboard.
 */
import { api, ApiError, API_BASE_URL } from "@/lib/api/client";

/** Verify the current password server-side, then set the new one. Throws on failure. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post("/api/auth/change-password", { currentPassword, newPassword });
  } catch (e) {
    if (e instanceof ApiError) {
      const m = safeMessage(e.body);
      if (m) throw new Error(m);
    }
    throw e instanceof Error ? e : new Error("Could not update the password.");
  }
}

/** Request a password-reset link. Never throws / never reveals account existence. */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

/** Re-send the email-verification link. Never throws / never reveals account existence. */
export async function resendVerification(email: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

function safeMessage(body: unknown): string | null {
  const obj = typeof body === "string" ? safeParse(body) : body;
  if (obj && typeof obj === "object" && "message" in obj) {
    const m = (obj as Record<string, unknown>).message;
    return typeof m === "string" && m ? m : null;
  }
  return null;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
