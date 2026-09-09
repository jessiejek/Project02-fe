/**
 * Patient files, vaccinations, reviews (INTEGRATION_ROADMAP.md Phase 6).
 * File uploads go to Project02-be local disk (multipart) instead of Supabase Storage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api, API_BASE_URL } from "@/lib/api/client";
import { resolveMode } from "./mode";

const dn = (r: Parameters<typeof resolveMode>[0]) => resolveMode(r) === "dotnet";

// ── patient_documents / patient_lab_results ──────────────────────────────
interface BookingDoctorEmbed {
  bookings?: { doctors?: { staff_accounts?: { full_name: string | null } | null } | null } | null;
}
export interface PatientDocumentRow extends BookingDoctorEmbed {
  id: string;
  patient_id: string;
  booking_id: string;
  file_name: string;
  file_size: number | null;
  file_content_type: string | null;
  title: string | null;
  description: string | null;
  file_url: string;
  uploaded_at: string;
}
export interface PatientLabResultRow extends BookingDoctorEmbed {
  id: string;
  patient_id: string;
  booking_id: string;
  file_name: string;
  result_title: string | null;
  result_text: string | null;
  status: string;
  file_url: string;
  uploaded_at: string;
}

/** Absolute URL for a stored file_url (the .NET value is a `/uploads/...` path). */
export function fileUrl(stored: string): string {
  return stored.startsWith("http") ? stored : `${API_BASE_URL}${stored}`;
}

export async function queryPatientDocuments(
  supabase: SupabaseClient,
  f: { patientId?: string; bookingId?: string },
): Promise<PatientDocumentRow[]> {
  if (dn("patient_documents")) {
    return api.get<PatientDocumentRow[]>("/api/patient-documents", {
      query: { patientId: f.patientId, bookingId: f.bookingId },
    });
  }
  let q = supabase.from("patient_documents").select("*, bookings(doctors(staff_accounts(full_name)))");
  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.bookingId) q = q.eq("booking_id", f.bookingId);
  const { data } = await q.order("uploaded_at", { ascending: false });
  return (data ?? []) as PatientDocumentRow[];
}

export async function queryPatientLabResults(
  supabase: SupabaseClient,
  f: { patientId?: string; bookingId?: string },
): Promise<PatientLabResultRow[]> {
  if (dn("patient_lab_results")) {
    return api.get<PatientLabResultRow[]>("/api/patient-lab-results", {
      query: { patientId: f.patientId, bookingId: f.bookingId },
    });
  }
  let q = supabase.from("patient_lab_results").select("*, bookings(doctors(staff_accounts(full_name)))");
  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.bookingId) q = q.eq("booking_id", f.bookingId);
  const { data } = await q.order("uploaded_at", { ascending: false });
  return (data ?? []) as PatientLabResultRow[];
}

export async function uploadPatientDocument(
  file: File,
  fields: { patientId: string; bookingId: string; title?: string; description?: string },
): Promise<PatientDocumentRow> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("patientId", fields.patientId);
  fd.set("bookingId", fields.bookingId);
  if (fields.title) fd.set("title", fields.title);
  if (fields.description) fd.set("description", fields.description);
  return api.post<PatientDocumentRow>("/api/patient-documents", fd);
}

export async function uploadPatientLabResult(
  file: File,
  fields: { patientId: string; bookingId: string; resultTitle?: string; resultText?: string },
): Promise<PatientLabResultRow> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("patientId", fields.patientId);
  fd.set("bookingId", fields.bookingId);
  if (fields.resultTitle) fd.set("resultTitle", fields.resultTitle);
  if (fields.resultText) fd.set("resultText", fields.resultText);
  return api.post<PatientLabResultRow>("/api/patient-lab-results", fd);
}

// ── patient_vaccinations ────────────────────────────────────────────────
export interface VaccinationRow {
  id: string;
  patient_id: string;
  vaccine_name: string;
  manufacturer: string | null;
  dose_number: number | null;
  administered_date: string | null;
  next_dose_date: string | null;
  status: string;
  source: string;
  notes: string | null;
}

export async function queryVaccinations(supabase: SupabaseClient, patientId: string): Promise<VaccinationRow[]> {
  if (dn("patient_vaccinations")) {
    return api.get<VaccinationRow[]>("/api/patient-vaccinations", { query: { patientId } });
  }
  const { data } = await supabase
    .from("patient_vaccinations")
    .select("*")
    .eq("patient_id", patientId)
    .order("administered_date", { ascending: false, nullsFirst: false });
  return (data ?? []) as VaccinationRow[];
}

// ── reviews ─────────────────────────────────────────────────────────────
export interface ReviewRow {
  review_id: string;
  booking_id: string;
  doctor_id: string;
  patient_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function queryReviews(
  supabase: SupabaseClient,
  f: { doctorId?: string; bookingId?: string },
): Promise<ReviewRow[]> {
  if (dn("reviews")) {
    return api.get<ReviewRow[]>("/api/reviews", { query: { doctorId: f.doctorId, bookingId: f.bookingId } });
  }
  let q = supabase.from("reviews").select("*");
  if (f.doctorId) q = q.eq("doctor_id", f.doctorId);
  if (f.bookingId) q = q.eq("booking_id", f.bookingId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as ReviewRow[];
}

export async function createReview(
  supabase: SupabaseClient,
  input: { booking_id: string; doctor_id: string; patient_id: string; rating: number; comment: string | null },
): Promise<void> {
  if (dn("reviews")) {
    await api.post("/api/reviews", input);
    return;
  }
  const { error } = await supabase.from("reviews").insert(input);
  if (error) throw error;
}
