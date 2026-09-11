/**
 * Patient reads. Canonical contract row shape (§4), served by the .NET API.
 *
 * The leading `_supabase` parameter is a migration vestige (callers pass
 * `null as never`).
 */
import { api } from "@/lib/api/client";
import { type PagedResult, type PageOpts, clampPage } from "./paging";

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

export type { PagedResult, PageOpts } from "./paging";
/** @deprecated use PageOpts from ./paging */
export type PatientsPageOpts = PageOpts;

/** §16.2 — server-side paged + searched patient list. */
export async function queryPatientsPaged(
  _supabase: unknown,
  opts: PageOpts = {},
): Promise<PagedResult<PatientRow>> {
  const { page, pageSize } = clampPage(opts);
  return api.get<PagedResult<PatientRow>>("/api/patients/search", {
    query: { q: opts.q || undefined, page, pageSize, sort: opts.sort || undefined },
  });
}

export async function queryPatients(
  _supabase: unknown,
  opts: { search?: string } = {},
): Promise<PatientRow[]> {
  return api.get<PatientRow[]>("/api/patients", {
    query: opts.search ? { search: opts.search } : undefined,
  });
}

export async function queryPatientById(
  _supabase: unknown,
  patientId: string,
): Promise<PatientRow | null> {
  try {
    return await api.get<PatientRow>(`/api/patients/${patientId}`);
  } catch {
    return null;
  }
}

export type PatientPatch = Partial<Omit<PatientRow, "patient_id" | "created_at" | "updated_at">>;

/** Guest / staff quick-register (no linked auth account). Returns the created row. */
export async function createPatient(
  _supabase: unknown,
  fields: {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    date_of_birth: string;
    sex: "Male" | "Female";
    contact_number?: string | null;
    address?: string | null;
    email?: string;
    patient_code?: string;
  },
): Promise<PatientRow> {
  const patient_code = fields.patient_code ?? `MF-${Math.floor(1000 + Math.random() * 9000)}`;
  const row = {
    patient_code,
    first_name: fields.first_name.trim(),
    middle_name: fields.middle_name?.trim() || null,
    last_name: fields.last_name.trim(),
    date_of_birth: fields.date_of_birth,
    sex: fields.sex,
    contact_number: fields.contact_number || null,
    address: fields.address?.trim() || null,
    email: fields.email ?? "",
    is_guest: true,
    user_id: null,
  };
  return api.post<PatientRow>("/api/patients", row);
}

/** Partial update — fetch-merge-put (PUT replaces the row). */
export async function updatePatient(
  _supabase: unknown,
  patientId: string,
  patch: PatientPatch,
): Promise<void> {
  const current = await api.get<Record<string, unknown>>(`/api/patients/${patientId}`);
  await api.put(`/api/patients/${patientId}`, { ...current, ...patch });
}

/** Consent acceptance. .NET: PUT /api/patients/{id}/consent with the version int. */
export async function updatePatientConsent(
  _supabase: unknown,
  patientId: string,
  consentVersion: number,
): Promise<void> {
  await api.put(`/api/patients/${patientId}/consent`, consentVersion);
}

/** The logged-in patient's own row. */
export async function queryMyPatient(
  _supabase: unknown,
  _userId: string,
): Promise<PatientRow | null> {
  try {
    return await api.get<PatientRow>("/api/patients/me");
  } catch {
    return null;
  }
}
