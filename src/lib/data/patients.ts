/**
 * Patient reads (INTEGRATION_ROADMAP.md Phase 2).
 * Returns the canonical contract row shape (§4) from either backend.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";
import { type PagedResult, type PageOpts, clientPage, clampPage } from "./paging";

export interface PatientRow {
  patient_id: string;
  user_id: string | null;
  patient_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: "Male" | "Female";
  civil_status: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  contact_number: string | null;
  email: string;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  emergency_contact_relationship: string | null;
  blood_type: string | null;
  philhealth_number: string | null;
  hmo_provider: string | null;
  hmo_card_number: string | null;
  is_guest: boolean;
  is_email_verified: boolean;
  consented_at: string | null;
  consent_version: number;
  created_at: string;
  updated_at: string;
}

const dotnet = () => resolveMode("patients") === "dotnet";

export type { PagedResult, PageOpts } from "./paging";
/** @deprecated use PageOpts from ./paging */
export type PatientsPageOpts = PageOpts;

/**
 * §16.2 — server-side paged + searched patient list. Falls back to a
 * client-side slice of the Supabase list when running in supabase mode.
 */
export async function queryPatientsPaged(
  supabase: SupabaseClient,
  opts: PageOpts = {},
): Promise<PagedResult<PatientRow>> {
  const { page, pageSize } = clampPage(opts);
  if (dotnet()) {
    return api.get<PagedResult<PatientRow>>("/api/patients/search", {
      query: { q: opts.q || undefined, page, pageSize, sort: opts.sort || undefined },
    });
  }
  return clientPage(await queryPatients(supabase, { search: opts.q }), opts);
}

export async function queryPatients(
  supabase: SupabaseClient,
  opts: { search?: string } = {},
): Promise<PatientRow[]> {
  if (dotnet()) {
    return api.get<PatientRow[]>("/api/patients", {
      query: opts.search ? { search: opts.search } : undefined,
    });
  }
  let q = supabase.from("patients").select("*");
  if (opts.search) {
    const s = opts.search.trim();
    q = q.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,patient_code.ilike.%${s}%,email.ilike.%${s}%`,
    );
  }
  const { data } = await q.order("last_name");
  return (data ?? []) as PatientRow[];
}

export async function queryPatientById(
  supabase: SupabaseClient,
  patientId: string,
): Promise<PatientRow | null> {
  if (dotnet()) {
    try {
      return await api.get<PatientRow>(`/api/patients/${patientId}`);
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("patients").select("*").eq("patient_id", patientId).maybeSingle();
  return (data as PatientRow) ?? null;
}

export type PatientPatch = Partial<Omit<PatientRow, "patient_id" | "created_at" | "updated_at">>;

/** Guest / staff quick-register (no linked auth account). Returns the created row. */
export async function createPatient(
  supabase: SupabaseClient,
  fields: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    sex: "Male" | "Female";
    contact_number?: string | null;
    email?: string;
    patient_code?: string;
  },
): Promise<PatientRow> {
  const patient_code = fields.patient_code ?? `MF-${Math.floor(1000 + Math.random() * 9000)}`;
  const row = {
    patient_code,
    first_name: fields.first_name.trim(),
    last_name: fields.last_name.trim(),
    date_of_birth: fields.date_of_birth,
    sex: fields.sex,
    contact_number: fields.contact_number || null,
    email: fields.email ?? "",
    is_guest: true,
    user_id: null,
  };
  if (dotnet()) {
    return api.post<PatientRow>("/api/patients", row);
  }
  const { data, error } = await supabase.from("patients").insert(row).select("*").single();
  if (error || !data) throw error ?? new Error("Could not create patient.");
  return data as PatientRow;
}

/** Partial update — fetch-merge-put in dotnet mode (PUT replaces the row). */
export async function updatePatient(
  supabase: SupabaseClient,
  patientId: string,
  patch: PatientPatch,
): Promise<void> {
  if (dotnet()) {
    const current = await api.get<Record<string, unknown>>(`/api/patients/${patientId}`);
    await api.put(`/api/patients/${patientId}`, { ...current, ...patch });
    return;
  }
  await supabase.from("patients").update(patch).eq("patient_id", patientId);
}

/** Consent acceptance. .NET: PUT /api/patients/{id}/consent with the version int. */
export async function updatePatientConsent(
  supabase: SupabaseClient,
  patientId: string,
  consentVersion: number,
): Promise<void> {
  if (dotnet()) {
    await api.put(`/api/patients/${patientId}/consent`, consentVersion);
    return;
  }
  await supabase
    .from("patients")
    .update({ consent_version: consentVersion, consented_at: new Date().toISOString() })
    .eq("patient_id", patientId);
}

/** The logged-in patient's own row. */
export async function queryMyPatient(
  supabase: SupabaseClient,
  userId: string,
): Promise<PatientRow | null> {
  if (dotnet()) {
    try {
      return await api.get<PatientRow>("/api/patients/me");
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("patients").select("*").eq("user_id", userId).maybeSingle();
  return (data as PatientRow) ?? null;
}
