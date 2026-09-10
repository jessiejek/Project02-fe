/**
 * Patient files, vaccinations, reviews (INTEGRATION_ROADMAP.md Phase 6).
 * File uploads go to Project02-be local disk (multipart) instead of Supabase Storage.
 */
import { api, API_BASE_URL } from "@/lib/api/client";

// The leading `_supabase` parameter on the query fns is a migration vestige
// (callers pass `null as never`); everything is served by the .NET API now.

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
  _supabase: unknown,
  f: { patientId?: string; bookingId?: string },
): Promise<PatientDocumentRow[]> {
  return api.get<PatientDocumentRow[]>("/api/patient-documents", {
    query: { patientId: f.patientId, bookingId: f.bookingId },
  });
}

export async function queryPatientLabResults(
  _supabase: unknown,
  f: { patientId?: string; bookingId?: string },
): Promise<PatientLabResultRow[]> {
  return api.get<PatientLabResultRow[]>("/api/patient-lab-results", {
    query: { patientId: f.patientId, bookingId: f.bookingId },
  });
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
  consultation_id: string | null;
  vaccine_name: string;
  manufacturer: string | null;
  dose_number: number | null;
  route: string | null;
  site: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  administered_date: string | null;
  next_dose_date: string | null;
  status: string;
  source: string;
  notes: string | null;
}

export async function queryVaccinations(_supabase: unknown, patientId: string): Promise<VaccinationRow[]> {
  return api.get<VaccinationRow[]>("/api/patient-vaccinations", { query: { patientId } });
}

export async function queryVaccinationsByConsultation(
  _supabase: unknown,
  consultationId: string,
): Promise<VaccinationRow[]> {
  try {
    return await api.get<VaccinationRow[]>(`/api/patient-vaccinations/by-consultation/${consultationId}`);
  } catch {
    return [];
  }
}

/** One dose staged in the consultation Vaccinations step. */
export interface VaccinationInput {
  vaccine_name: string;
  manufacturer?: string | null;
  dose_number?: number | null;
  route?: string | null;
  site?: string | null;
  lot_number?: string | null;
  expiry_date?: string | null;
  next_dose_date?: string | null;
  notes?: string | null;
}

/**
 * Replace-all the doses administered at one consultation (keyed on
 * consultation_id, same shape as lab orders). Only touches this visit's
 * in-clinic rows — the patient's wider history is left alone.
 */
export async function replaceVaccinationsByConsultation(
  _supabase: unknown,
  consultationId: string,
  items: VaccinationInput[],
): Promise<VaccinationRow[]> {
  return api.put<VaccinationRow[]>(`/api/patient-vaccinations/by-consultation/${consultationId}`, items);
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
  _supabase: unknown,
  f: { doctorId?: string; bookingId?: string },
): Promise<ReviewRow[]> {
  return api.get<ReviewRow[]>("/api/reviews", { query: { doctorId: f.doctorId, bookingId: f.bookingId } });
}

export async function createReview(
  _supabase: unknown,
  input: { booking_id: string; doctor_id: string; patient_id: string; rating: number; comment: string | null },
): Promise<void> {
  await api.post("/api/reviews", input);
}
