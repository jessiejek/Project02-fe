/**
 * Auth backend switch for the Supabase → .NET migration (INTEGRATION_ROADMAP.md Phase 1).
 *
 *   NEXT_PUBLIC_AUTH_MODE = "supabase" (default) | "dotnet"
 *
 * "supabase": unchanged — Supabase Auth drives login, session, and route gating.
 * "dotnet":   the .NET JWT (issued by Project02-be /api/auth/login, stored in
 *             httpOnly cookies) is the source of truth for identity and route
 *             gating. A parallel Supabase session is still established at login
 *             purely so not-yet-migrated `.from(...)` calls keep satisfying RLS
 *             — it is a compatibility crutch, removed in Phase 7.
 */

export type AuthMode = "supabase" | "dotnet";

export const AUTH_MODE: AuthMode =
  process.env.NEXT_PUBLIC_AUTH_MODE === "dotnet" ? "dotnet" : "supabase";

export const isDotnetAuth = AUTH_MODE === "dotnet";
