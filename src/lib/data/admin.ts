/**
 * Admin settings / announcements / audit / reports (INTEGRATION_ROADMAP.md Phase 7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";

const dn = (r: Parameters<typeof resolveMode>[0]) => resolveMode(r) === "dotnet";

// ── clinic_settings ─────────────────────────────────────────────────────
export interface ClinicSettingsRow {
  id: number;
  clinic_name: string;
  address: string;
  contact_number: string | null;
  email: string | null;
  description: string | null;
  default_payment_mode: string;
  refund_policy: string | null;
  consent_version: number;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  website_url: string | null;
  privacy_policy_text: string | null;
  // §16.6 flat clinic-wide fee schedule.
  fee_consultation: number;
  fee_follow_up: number;
  fee_senior_pwd: number;
  fee_med_cert: number;
  discount_pct: number;
  updated_at: string;
}

export async function queryClinicSettings(supabase: SupabaseClient): Promise<ClinicSettingsRow | null> {
  if (dn("clinic_settings")) {
    try {
      return await api.get<ClinicSettingsRow>("/api/settings", { anonymous: true });
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("clinic_settings").select("*").eq("id", 1).maybeSingle();
  return (data as ClinicSettingsRow) ?? null;
}

export async function updateClinicSettings(
  supabase: SupabaseClient,
  patch: Partial<ClinicSettingsRow>,
): Promise<void> {
  if (dn("clinic_settings")) {
    const current = await api.get<ClinicSettingsRow>("/api/settings", { anonymous: true });
    await api.put("/api/settings", { ...current, ...patch });
    return;
  }
  await supabase.from("clinic_settings").update(patch).eq("id", 1);
}

// ── clinic_operating_hours ─────────────────────────────────────────────
export interface OperatingHourRow {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

export async function queryOperatingHours(supabase: SupabaseClient): Promise<OperatingHourRow[]> {
  if (dn("clinic_operating_hours")) {
    return api.get<OperatingHourRow[]>("/api/admin/operating-hours", { anonymous: true });
  }
  const { data } = await supabase.from("clinic_operating_hours").select("*").order("day_of_week");
  return (data ?? []) as OperatingHourRow[];
}

export async function setOperatingHours(supabase: SupabaseClient, hours: OperatingHourRow[]): Promise<void> {
  if (dn("clinic_operating_hours")) {
    await api.put("/api/admin/operating-hours", hours);
    return;
  }
  await supabase.from("clinic_operating_hours").upsert(hours, { onConflict: "day_of_week" });
}

// ── clinic_accepted_payment_methods ───────────────────────────────────
export async function queryPaymentMethods(supabase: SupabaseClient): Promise<string[]> {
  if (dn("clinic_accepted_payment_methods")) {
    const rows = await api.get<{ payment_method: string }[]>("/api/admin/payment-methods", { anonymous: true });
    return rows.map((r) => r.payment_method);
  }
  const { data } = await supabase.from("clinic_accepted_payment_methods").select("payment_method");
  return (data ?? []).map((r) => r.payment_method as string);
}

export async function setPaymentMethods(supabase: SupabaseClient, methods: string[]): Promise<void> {
  if (dn("clinic_accepted_payment_methods")) {
    await api.put("/api/admin/payment-methods", methods);
    return;
  }
  await supabase.from("clinic_accepted_payment_methods").delete().not("payment_method", "is", null);
  if (methods.length) {
    await supabase.from("clinic_accepted_payment_methods").insert(methods.map((m) => ({ payment_method: m })));
  }
}

// ── announcements ─────────────────────────────────────────────────────
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  posted_by_user_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export async function queryAnnouncements(
  supabase: SupabaseClient,
  opts: { activeOnly?: boolean } = {},
): Promise<AnnouncementRow[]> {
  if (dn("announcements")) {
    return api.get<AnnouncementRow[]>("/api/announcements", {
      anonymous: true,
      query: { activeOnly: opts.activeOnly ?? false },
    });
  }
  let q = supabase.from("announcements").select("*");
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as AnnouncementRow[];
}

export async function createAnnouncement(
  supabase: SupabaseClient,
  input: { title: string; body: string; is_active: boolean },
): Promise<AnnouncementRow> {
  if (dn("announcements")) return api.post<AnnouncementRow>("/api/announcements", input);
  const { data } = await supabase.from("announcements").insert(input).select("*").single();
  return data as AnnouncementRow;
}

export async function updateAnnouncement(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<AnnouncementRow, "title" | "body" | "is_active">>,
): Promise<void> {
  if (dn("announcements")) {
    const cur = (await queryAnnouncements(supabase)).find((a) => a.id === id);
    await api.put(`/api/announcements/${id}`, { ...cur, ...patch });
    return;
  }
  await supabase.from("announcements").update(patch).eq("id", id);
}

export async function deleteAnnouncement(supabase: SupabaseClient, id: string): Promise<void> {
  if (dn("announcements")) {
    await api.delete(`/api/announcements/${id}`);
    return;
  }
  await supabase.from("announcements").delete().eq("id", id);
}

// ── audit_logs (read) ─────────────────────────────────────────────────
export interface AuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by_user_id: string | null;
  details: string | null;
  performed_at: string;
}

export async function queryAuditLogs(
  supabase: SupabaseClient,
  opts: { entityType?: string; entityId?: string; take?: number } = {},
): Promise<AuditLogRow[]> {
  if (dn("audit_logs")) {
    return api.get<AuditLogRow[]>("/api/audit-logs", {
      query: { entityType: opts.entityType, entityId: opts.entityId, take: opts.take ?? 100 },
    });
  }
  let q = supabase.from("audit_logs").select("*");
  if (opts.entityType) q = q.eq("entity_type", opts.entityType);
  if (opts.entityId) q = q.eq("entity_id", opts.entityId);
  const { data } = await q.order("performed_at", { ascending: false }).limit(opts.take ?? 100);
  return (data ?? []) as AuditLogRow[];
}

export interface DoctorRatingRow {
  doctor_id: string;
  average_rating: number;
  review_count: number;
}

export async function queryDoctorRatings(supabase: SupabaseClient): Promise<DoctorRatingRow[]> {
  const rows = await queryReport<Record<string, unknown>>(supabase, "v_doctor_ratings");
  return rows.map((r) => ({
    doctor_id: String(r.doctor_id ?? ""),
    average_rating: Number(r.average_rating ?? 0),
    review_count: Number(r.review_count ?? 0),
  }));
}

// ── v_doctor_earnings (§16.9) — .NET-only view, no Supabase equivalent ──
export interface DoctorEarningsRow {
  doctor_id: string;
  period: string; // 'YYYY-MM'
  completed_visits: number;
  gross_billed: number;
  collected: number;
  waived: number;
}

/**
 * Monthly earnings. A Doctor caller only ever gets their own rows (the API
 * scopes by JWT); an Admin may pass `doctorId` to scope, or omit it for all.
 */
export async function queryDoctorEarnings(
  _supabase: SupabaseClient,
  doctorId?: string,
): Promise<DoctorEarningsRow[]> {
  const rows = await api.get<Record<string, unknown>[]>("/api/reports/doctor-earnings", {
    query: doctorId ? { doctorId } : undefined,
  });
  return rows.map((r) => ({
    doctor_id: String(r.doctor_id ?? ""),
    period: String(r.period ?? ""),
    completed_visits: Number(r.completed_visits ?? 0),
    gross_billed: Number(r.gross_billed ?? 0),
    collected: Number(r.collected ?? 0),
    waived: Number(r.waived ?? 0),
  }));
}

// ── reports (4 views) ────────────────────────────────────────────────
export async function queryReport<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  view:
    | "v_doctor_ratings"
    | "v_daily_booking_summary"
    | "v_unpaid_completed_visits"
    | "v_pending_follow_ups",
): Promise<T[]> {
  const pathByView = {
    v_doctor_ratings: "doctor-ratings",
    v_daily_booking_summary: "daily-booking-summary",
    v_unpaid_completed_visits: "unpaid-completed-visits",
    v_pending_follow_ups: "pending-follow-ups",
  } as const;
  if (dn("reports")) {
    return api.get<T[]>(`/api/reports/${pathByView[view]}`);
  }
  const { data } = await supabase.from(view).select("*");
  return (data ?? []) as T[];
}
