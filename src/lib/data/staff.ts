/**
 * Staff-account reads. Backed by the .NET API (`/api/staff-accounts*`).
 * staff_accounts covers Staff / Doctor / Admin. Canonical §4 row shape.
 *
 * The leading `_supabase` parameter is a migration vestige (callers pass
 * `null as never`) — kept only to avoid churning every call site.
 */
import { api } from "@/lib/api/client";
import { type PagedResult, type PageOpts, clampPage } from "./paging";

export interface StaffAccountRow {
  staff_id: string;
  user_id: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  role: "Staff" | "Doctor" | "Admin";
  status: "Active" | "Inactive" | "Invited" | "OnLeave";
  avatar_url: string | null;
  invited_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function queryStaffAccounts(
  _supabase: unknown,
  opts: { role?: "Staff" | "Doctor" | "Admin" } = {},
): Promise<StaffAccountRow[]> {
  return api.get<StaffAccountRow[]>("/api/staff-accounts", {
    query: opts.role ? { role: opts.role } : undefined,
  });
}

/** §16.2 — server-side paged + searched staff list (admin Staff Management). */
export async function queryStaffAccountsPaged(
  _supabase: unknown,
  opts: PageOpts & { role?: "Staff" | "Doctor" | "Admin" } = {},
): Promise<PagedResult<StaffAccountRow>> {
  const { page, pageSize } = clampPage(opts);
  return api.get<PagedResult<StaffAccountRow>>("/api/staff-accounts/search", {
    query: { q: opts.q || undefined, role: opts.role, sort: opts.sort || undefined, page, pageSize },
  });
}

export type StaffPatch = Partial<{
  full_name: string;
  contact_number: string | null;
  status: StaffAccountRow["status"];
}>;

/** Partial update — fetch-merge-put (PUT replaces the row). */
export async function updateStaffAccount(
  _supabase: unknown,
  staffId: string,
  patch: StaffPatch,
): Promise<void> {
  const current = await api.get<Record<string, unknown>>(`/api/staff-accounts/${staffId}`);
  await api.put(`/api/staff-accounts/${staffId}`, { ...current, ...patch });
}

export async function queryStaffById(
  _supabase: unknown,
  staffId: string,
): Promise<StaffAccountRow | null> {
  try {
    return await api.get<StaffAccountRow>(`/api/staff-accounts/${staffId}`);
  } catch {
    return null;
  }
}
