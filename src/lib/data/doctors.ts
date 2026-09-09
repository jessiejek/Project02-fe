/**
 * Doctor directory reads (INTEGRATION_ROADMAP.md Phase 2).
 *
 * Returns the canonical contract row shape (§4/§6) regardless of backend, so
 * page code keeps reading `d.staff_accounts?.full_name` etc. unchanged.
 * `resolveMode("doctors")` picks Supabase (today) or the .NET API.
 *
 * Sites still calling `supabase.from("doctors")` directly keep working via the
 * parallel Supabase data — migrate them to these helpers over time.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { one } from "@/lib/one";
import { resolveMode } from "./mode";

export interface DoctorStaffEmbed {
  full_name: string | null;
  status: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface DoctorRow {
  doctor_id: string;
  specialization: string;
  consultation_fee: number;
  bio: string | null;
  license_number: string | null;
  ptr_number: string | null;
  s2_number: string | null;
  slot_duration_minutes: number;
  slot_capacity: number;
  daily_patient_limit: number | null;
  created_at?: string;
  updated_at?: string;
  staff_accounts: DoctorStaffEmbed | null;
}

// Union of the staff fields any doctor screen reads. Both backends are
// projected to exactly this so parity diffs are meaningful.
const STAFF_SELECT = "full_name, status, email, avatar_url";

type RawStaff = Partial<DoctorStaffEmbed> | Partial<DoctorStaffEmbed>[] | null | undefined;

function projectDoctor(raw: Record<string, unknown>): DoctorRow {
  const s = one(raw.staff_accounts as RawStaff);
  return {
    doctor_id: String(raw.doctor_id ?? ""),
    specialization: String(raw.specialization ?? ""),
    consultation_fee: Number(raw.consultation_fee ?? 0),
    bio: (raw.bio as string) ?? null,
    license_number: (raw.license_number as string) ?? null,
    ptr_number: (raw.ptr_number as string) ?? null,
    s2_number: (raw.s2_number as string) ?? null,
    slot_duration_minutes: Number(raw.slot_duration_minutes ?? 30),
    slot_capacity: Number(raw.slot_capacity ?? 1),
    daily_patient_limit:
      raw.daily_patient_limit == null ? null : Number(raw.daily_patient_limit),
    staff_accounts: s
      ? {
          full_name: s.full_name ?? null,
          status: s.status ?? null,
          email: s.email ?? null,
          avatar_url: s.avatar_url ?? null,
        }
      : null,
  };
}

export async function queryDoctors(supabase: SupabaseClient): Promise<DoctorRow[]> {
  if (resolveMode("doctors") === "dotnet") {
    const rows = await api.get<Record<string, unknown>[]>("/api/doctors", { anonymous: true });
    return rows.map(projectDoctor);
  }
  const { data } = await supabase.from("doctors").select(`*, staff_accounts(${STAFF_SELECT})`);
  return (data ?? []).map((r) => projectDoctor(r as Record<string, unknown>));
}

/** Doctor scalar fields the FE edits (snake_case, all optional / partial patch). */
export type DoctorPatch = Partial<{
  specialization: string;
  consultation_fee: number;
  bio: string | null;
  license_number: string | null;
  ptr_number: string | null;
  s2_number: string | null;
  slot_duration_minutes: number;
  slot_capacity: number;
  daily_patient_limit: number | null;
}>;

/**
 * Partial update. .NET's PUT /api/doctors/{id} replaces the whole row, so in
 * dotnet mode we fetch-merge-put to avoid clobbering unsent fields; Supabase
 * `.update()` is already partial.
 */
export async function updateDoctor(
  supabase: SupabaseClient,
  doctorId: string,
  patch: DoctorPatch,
): Promise<void> {
  if (resolveMode("doctors") === "dotnet") {
    const current = await api.get<Record<string, unknown>>(`/api/doctors/${doctorId}`);
    delete current.staff_accounts;
    await api.put(`/api/doctors/${doctorId}`, { ...current, ...patch });
    return;
  }
  await supabase.from("doctors").update(patch).eq("doctor_id", doctorId);
}

export async function queryDoctorById(
  supabase: SupabaseClient,
  doctorId: string,
): Promise<DoctorRow | null> {
  if (resolveMode("doctors") === "dotnet") {
    try {
      const row = await api.get<Record<string, unknown>>(`/api/doctors/${doctorId}`, { anonymous: true });
      return projectDoctor(row);
    } catch {
      return null;
    }
  }
  const { data } = await supabase
    .from("doctors")
    .select(`*, staff_accounts(${STAFF_SELECT})`)
    .eq("doctor_id", doctorId)
    .maybeSingle();
  return data ? projectDoctor(data as Record<string, unknown>) : null;
}
