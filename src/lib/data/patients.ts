/**
 * Patient reads (INTEGRATION_ROADMAP.md Phase 2).
 * Returns the canonical contract row shape (§4) from either backend.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";

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
