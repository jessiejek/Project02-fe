/**
 * Doctor day-status + weekly schedule (INTEGRATION_ROADMAP.md Phase 8.3 tail).
 *
 * The clinic has no appointment slots (§16.3) so `doctor_schedules` is vestigial,
 * but the day-status ("Available / Running Late / Unavailable Today") is a real,
 * used feature. Served by DoctorsController on the .NET API.
 *
 * The leading `_supabase` parameter is a migration vestige (callers pass
 * `null as never`).
 */
import { api } from "@/lib/api/client";

export type DayStatus = "Available" | "RunningLate" | "UnavailableToday";

export interface DoctorDayStatusRow {
  id?: string;
  doctor_id: string;
  status_date: string;
  status: DayStatus;
  running_late_minutes: number | null;
}

export async function queryDayStatus(
  _supabase: unknown,
  doctorId: string,
  date: string,
): Promise<DoctorDayStatusRow | null> {
  const row = await api.get<DoctorDayStatusRow | null>(`/api/doctors/${doctorId}/day-status`, {
    query: { date },
  });
  return row ?? null;
}

export async function queryDayStatuses(
  _supabase: unknown,
  date: string,
): Promise<DoctorDayStatusRow[]> {
  return api.get<DoctorDayStatusRow[]>("/api/doctors/day-statuses", { query: { date } });
}

export async function setDayStatus(
  _supabase: unknown,
  doctorId: string,
  date: string,
  status: DayStatus,
  runningLateMinutes: number | null = null,
): Promise<void> {
  await api.put(`/api/doctors/${doctorId}/day-status`, {
    doctor_id: doctorId,
    status_date: date,
    status,
    running_late_minutes: runningLateMinutes,
  });
}

export interface DoctorScheduleRow {
  id?: string;
  doctor_id: string;
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
}

export async function queryDoctorSchedules(
  _supabase: unknown,
  doctorId: string,
): Promise<DoctorScheduleRow[]> {
  const rows = await api.get<DoctorScheduleRow[]>(`/api/doctors/${doctorId}/schedules`, { anonymous: true });
  // The API returns rows in insertion order; every consumer wants them Sun→Sat.
  return [...rows].sort((a, b) => a.day_of_week - b.day_of_week);
}

export async function upsertDoctorSchedule(
  _supabase: unknown,
  doctorId: string,
  row: Omit<DoctorScheduleRow, "id" | "doctor_id">,
): Promise<void> {
  await api.put(`/api/doctors/${doctorId}/schedules`, { doctor_id: doctorId, ...row });
}

export interface BlockedDateRow {
  id: string;
  doctor_id?: string;
  blocked_date: string;
  reason: string | null;
}

export async function queryBlockedDates(
  _supabase: unknown,
  doctorId: string,
): Promise<BlockedDateRow[]> {
  return api.get<BlockedDateRow[]>(`/api/doctors/${doctorId}/blocked-dates`);
}

export async function addBlockedDate(
  _supabase: unknown,
  doctorId: string,
  blockedDate: string,
  reason: string | null,
): Promise<BlockedDateRow> {
  return api.post<BlockedDateRow>(`/api/doctors/${doctorId}/blocked-dates`, {
    doctor_id: doctorId,
    blocked_date: blockedDate,
    reason,
  });
}

export async function removeBlockedDate(_supabase: unknown, id: string): Promise<void> {
  await api.delete(`/api/doctors/blocked-dates/${id}`);
}
