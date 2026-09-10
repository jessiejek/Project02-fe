/**
 * Admin settings / announcements / audit / reports (INTEGRATION_ROADMAP.md Phase 7).
 * Served by the .NET API. The leading `_supabase` parameter is a migration
 * vestige (callers pass `null as never`).
 */
import { api } from "@/lib/api/client";
import { type PagedResult, type PageOpts, clampPage } from "./paging";

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

export async function queryClinicSettings(_supabase?: unknown): Promise<ClinicSettingsRow | null> {
  try {
    return await api.get<ClinicSettingsRow>("/api/settings", { anonymous: true });
  } catch {
    return null;
  }
}

export async function updateClinicSettings(
  _supabase: unknown,
  patch: Partial<ClinicSettingsRow>,
): Promise<void> {
  const current = await api.get<ClinicSettingsRow>("/api/settings", { anonymous: true });
  await api.put("/api/settings", { ...current, ...patch });
}

// ── clinic_operating_hours ─────────────────────────────────────────────
export interface OperatingHourRow {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

export async function queryOperatingHours(_supabase?: unknown): Promise<OperatingHourRow[]> {
  return api.get<OperatingHourRow[]>("/api/admin/operating-hours", { anonymous: true });
}

export async function setOperatingHours(_supabase: unknown, hours: OperatingHourRow[]): Promise<void> {
  await api.put("/api/admin/operating-hours", hours);
}

// ── clinic_accepted_payment_methods ───────────────────────────────────
export async function queryPaymentMethods(_supabase?: unknown): Promise<string[]> {
  const rows = await api.get<{ payment_method: string }[]>("/api/admin/payment-methods", { anonymous: true });
  return rows.map((r) => r.payment_method);
}

export async function setPaymentMethods(_supabase: unknown, methods: string[]): Promise<void> {
  await api.put("/api/admin/payment-methods", methods);
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
  _supabase: unknown,
  opts: { activeOnly?: boolean } = {},
): Promise<AnnouncementRow[]> {
  return api.get<AnnouncementRow[]>("/api/announcements", {
    anonymous: true,
    query: { activeOnly: opts.activeOnly ?? false },
  });
}

export async function createAnnouncement(
  _supabase: unknown,
  input: { title: string; body: string; is_active: boolean },
): Promise<AnnouncementRow> {
  return api.post<AnnouncementRow>("/api/announcements", input);
}

export async function updateAnnouncement(
  _supabase: unknown,
  id: string,
  patch: Partial<Pick<AnnouncementRow, "title" | "body" | "is_active">>,
): Promise<void> {
  const cur = (await queryAnnouncements(null)).find((a) => a.id === id);
  await api.put(`/api/announcements/${id}`, { ...cur, ...patch });
}

export async function deleteAnnouncement(_supabase: unknown, id: string): Promise<void> {
  await api.delete(`/api/announcements/${id}`);
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
  _supabase: unknown,
  opts: { entityType?: string; entityId?: string; take?: number } = {},
): Promise<AuditLogRow[]> {
  return api.get<AuditLogRow[]>("/api/audit-logs", {
    query: { entityType: opts.entityType, entityId: opts.entityId, take: opts.take ?? 100 },
  });
}

/** §16.2 — server-side paged + searched audit trail (admin screen). */
export async function queryAuditLogsPaged(
  _supabase: unknown,
  opts: PageOpts & { entityType?: string } = {},
): Promise<PagedResult<AuditLogRow>> {
  const { page, pageSize } = clampPage(opts);
  return api.get<PagedResult<AuditLogRow>>("/api/audit-logs/search", {
    query: { q: opts.q || undefined, entityType: opts.entityType, page, pageSize },
  });
}

export interface DoctorRatingRow {
  doctor_id: string;
  average_rating: number;
  review_count: number;
}

export async function queryDoctorRatings(_supabase?: unknown): Promise<DoctorRatingRow[]> {
  const rows = await queryReport<Record<string, unknown>>(null, "v_doctor_ratings");
  return rows.map((r) => ({
    doctor_id: String(r.doctor_id ?? ""),
    average_rating: Number(r.average_rating ?? 0),
    review_count: Number(r.review_count ?? 0),
  }));
}

// ── v_doctor_earnings (§16.9) ─────────────────────────────────────────
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
  _supabase: unknown,
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
  _supabase: unknown,
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
  return api.get<T[]>(`/api/reports/${pathByView[view]}`);
}
