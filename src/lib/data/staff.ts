/**
 * Staff-account reads (INTEGRATION_ROADMAP.md Phase 2).
 * staff_accounts covers Staff / Doctor / Admin. Canonical §4 row shape.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";
import { type PagedResult, type PageOpts, clientPage, clampPage } from "./paging";

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

const dotnet = () => resolveMode("staff_accounts") === "dotnet";

export async function queryStaffAccounts(
  supabase: SupabaseClient,
  opts: { role?: "Staff" | "Doctor" | "Admin" } = {},
): Promise<StaffAccountRow[]> {
  if (dotnet()) {
    return api.get<StaffAccountRow[]>("/api/staff-accounts", {
      query: opts.role ? { role: opts.role } : undefined,
    });
  }
  let q = supabase.from("staff_accounts").select("*");
  if (opts.role) q = q.eq("role", opts.role);
  const { data } = await q.order("full_name");
  return (data ?? []) as StaffAccountRow[];
}

/** §16.2 — server-side paged + searched staff list (admin Staff Management). */
export async function queryStaffAccountsPaged(
  supabase: SupabaseClient,
  opts: PageOpts & { role?: "Staff" | "Doctor" | "Admin" } = {},
): Promise<PagedResult<StaffAccountRow>> {
  const { page, pageSize } = clampPage(opts);
  if (dotnet()) {
    return api.get<PagedResult<StaffAccountRow>>("/api/staff-accounts/search", {
      query: { q: opts.q || undefined, role: opts.role, sort: opts.sort || undefined, page, pageSize },
    });
  }
  const all = await queryStaffAccounts(supabase, { role: opts.role });
  const q = (opts.q ?? "").toLowerCase();
  const filtered = q ? all.filter((s) => `${s.full_name} ${s.email}`.toLowerCase().includes(q)) : all;
  return clientPage(filtered, opts);
}

export type StaffPatch = Partial<{
  full_name: string;
  contact_number: string | null;
  status: StaffAccountRow["status"];
}>;

/** Partial update — fetch-merge-put in dotnet mode (PUT replaces the row). */
export async function updateStaffAccount(
  supabase: SupabaseClient,
  staffId: string,
  patch: StaffPatch,
): Promise<void> {
  if (dotnet()) {
    const current = await api.get<Record<string, unknown>>(`/api/staff-accounts/${staffId}`);
    await api.put(`/api/staff-accounts/${staffId}`, { ...current, ...patch });
    return;
  }
  await supabase.from("staff_accounts").update(patch).eq("staff_id", staffId);
}

export async function queryStaffById(
  supabase: SupabaseClient,
  staffId: string,
): Promise<StaffAccountRow | null> {
  if (dotnet()) {
    try {
      return await api.get<StaffAccountRow>(`/api/staff-accounts/${staffId}`);
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("staff_accounts").select("*").eq("staff_id", staffId).maybeSingle();
  return (data as StaffAccountRow) ?? null;
}
