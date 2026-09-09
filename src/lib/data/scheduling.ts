/**
 * Doctor day-status + weekly schedule (INTEGRATION_ROADMAP.md Phase 8.3 tail).
 *
 * The clinic has no appointment slots (§16.3) so `doctor_schedules` is vestigial,
 * but the day-status ("Available / Running Late / Unavailable Today") is a real,
 * used feature. .NET endpoints already exist on DoctorsController; these wrap them
 * and keep a Supabase fallback for debug mode.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";

const dnDayStatus = () => resolveMode("doctor_day_statuses") === "dotnet";
const dnSchedule = () => resolveMode("doctor_schedules") === "dotnet";

export type DayStatus = "Available" | "RunningLate" | "UnavailableToday";

export interface DoctorDayStatusRow {
  id?: string;
  doctor_id: string;
  status_date: string;
  status: DayStatus;
  running_late_minutes: number | null;
}

export async function queryDayStatus(
  supabase: SupabaseClient,
  doctorId: string,
  date: string,
): Promise<DoctorDayStatusRow | null> {
  if (dnDayStatus()) {
    const row = await api.get<DoctorDayStatusRow | null>(`/api/doctors/${doctorId}/day-status`, {
      query: { date },
    });
    return row ?? null;
  }
  const { data } = await supabase
    .from("doctor_day_statuses")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("status_date", date)
    .maybeSingle();
  return (data as DoctorDayStatusRow) ?? null;
}

export async function queryDayStatuses(
  supabase: SupabaseClient,
  date: string,
): Promise<DoctorDayStatusRow[]> {
  if (dnDayStatus()) {
    return api.get<DoctorDayStatusRow[]>("/api/doctors/day-statuses", { query: { date } });
  }
  const { data } = await supabase.from("doctor_day_statuses").select("*").eq("status_date", date);
  return (data ?? []) as DoctorDayStatusRow[];
}

export async function setDayStatus(
  supabase: SupabaseClient,
  doctorId: string,
  date: string,
  status: DayStatus,
  runningLateMinutes: number | null = null,
): Promise<void> {
  if (dnDayStatus()) {
    await api.put(`/api/doctors/${doctorId}/day-status`, {
      doctor_id: doctorId,
      status_date: date,
      status,
      running_late_minutes: runningLateMinutes,
    });
    return;
  }
  await supabase
    .from("doctor_day_statuses")
    .upsert(
      { doctor_id: doctorId, status_date: date, status, running_late_minutes: runningLateMinutes },
      { onConflict: "doctor_id,status_date" },
    );
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
  supabase: SupabaseClient,
  doctorId: string,
): Promise<DoctorScheduleRow[]> {
  if (dnSchedule()) {
    return api.get<DoctorScheduleRow[]>(`/api/doctors/${doctorId}/schedules`, { anonymous: true });
  }
  const { data } = await supabase
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("day_of_week");
  return (data ?? []) as DoctorScheduleRow[];
}

export async function upsertDoctorSchedule(
  supabase: SupabaseClient,
  doctorId: string,
  row: Omit<DoctorScheduleRow, "id" | "doctor_id">,
): Promise<void> {
  if (dnSchedule()) {
    await api.put(`/api/doctors/${doctorId}/schedules`, { doctor_id: doctorId, ...row });
    return;
  }
  await supabase
    .from("doctor_schedules")
    .upsert({ doctor_id: doctorId, ...row }, { onConflict: "doctor_id,day_of_week" });
}

export interface BlockedDateRow {
  id: string;
  doctor_id?: string;
  blocked_date: string;
  reason: string | null;
}

const dnBlocked = () => resolveMode("doctor_blocked_dates") === "dotnet";

export async function queryBlockedDates(
  supabase: SupabaseClient,
  doctorId: string,
): Promise<BlockedDateRow[]> {
  if (dnBlocked()) {
    return api.get<BlockedDateRow[]>(`/api/doctors/${doctorId}/blocked-dates`);
  }
  const { data } = await supabase
    .from("doctor_blocked_dates")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("blocked_date");
  return (data ?? []) as BlockedDateRow[];
}

export async function addBlockedDate(
  supabase: SupabaseClient,
  doctorId: string,
  blockedDate: string,
  reason: string | null,
): Promise<BlockedDateRow> {
  if (dnBlocked()) {
    return api.post<BlockedDateRow>(`/api/doctors/${doctorId}/blocked-dates`, {
      doctor_id: doctorId,
      blocked_date: blockedDate,
      reason,
    });
  }
  const { data } = await supabase
    .from("doctor_blocked_dates")
    .insert({ doctor_id: doctorId, blocked_date: blockedDate, reason })
    .select("*")
    .single();
  return data as BlockedDateRow;
}

export async function removeBlockedDate(supabase: SupabaseClient, id: string): Promise<void> {
  if (dnBlocked()) {
    await api.delete(`/api/doctors/blocked-dates/${id}`);
    return;
  }
  await supabase.from("doctor_blocked_dates").delete().eq("id", id);
}
