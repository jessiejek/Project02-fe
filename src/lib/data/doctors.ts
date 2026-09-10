/**
 * Doctor directory reads. Backed entirely by the .NET API (`/api/doctors*`);
 * returns the canonical contract row shape (§4/§6) so page code reads
 * `d.staff_accounts?.full_name` etc. unchanged.
 *
 * The leading `_supabase` parameter is a vestige of the Supabase→.NET migration
 * (call sites pass `null as never`) — kept only to avoid churning every caller.
 */
import { api } from "@/lib/api/client";
import { one } from "@/lib/one";
import { type PagedResult, type PageOpts, clampPage } from "./paging";

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

export async function queryDoctors(_supabase?: unknown): Promise<DoctorRow[]> {
  const rows = await api.get<Record<string, unknown>[]>("/api/doctors", { anonymous: true });
  return rows.map(projectDoctor);
}

/** §16.2 — server-side paged + searched doctor list (admin management screen). */
export async function queryDoctorsPaged(
  _supabase: unknown,
  opts: PageOpts = {},
): Promise<PagedResult<DoctorRow>> {
  const { page, pageSize } = clampPage(opts);
  const res = await api.get<PagedResult<Record<string, unknown>>>("/api/doctors/search", {
    query: { q: opts.q || undefined, sort: opts.sort || undefined, page, pageSize },
  });
  return { ...res, items: res.items.map(projectDoctor) };
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
 * Partial update. .NET's PUT /api/doctors/{id} replaces the whole row, so we
 * fetch-merge-put to avoid clobbering unsent fields.
 */
export async function updateDoctor(
  _supabase: unknown,
  doctorId: string,
  patch: DoctorPatch,
): Promise<void> {
  const current = await api.get<Record<string, unknown>>(`/api/doctors/${doctorId}`);
  delete current.staff_accounts;
  await api.put(`/api/doctors/${doctorId}`, { ...current, ...patch });
}

export async function queryDoctorById(
  _supabase: unknown,
  doctorId: string,
): Promise<DoctorRow | null> {
  try {
    const row = await api.get<Record<string, unknown>>(`/api/doctors/${doctorId}`, { anonymous: true });
    return projectDoctor(row);
  } catch {
    return null;
  }
}
