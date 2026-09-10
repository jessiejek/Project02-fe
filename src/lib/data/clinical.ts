/**
 * Clinical resources (INTEGRATION_ROADMAP.md Phase 5): consultations,
 * consultation_diagnoses, patient_vital_readings, follow_ups, prescription_*,
 * soap_*, medical_certificates, audit_logs write.
 *
 * Canonical §4/§6 shapes, served entirely by the .NET API. The leading
 * `_supabase` parameter is a migration vestige (callers pass `null as never`).
 */
import { api } from "@/lib/api/client";

// ── consultations ──────────────────────────────────────────────────────────
export interface ConsultationRow {
  consultation_id: string;
  booking_id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  doctor_notes: string | null;
  completed_by_user_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // §6 embeds (present on list/by-booking reads)
  bookings?: { appointment_date: string | null; doctor_id?: string | null } | null;
  doctors?: { staff_accounts: { full_name: string | null } | null } | null;
  consultation_diagnoses?: Array<{ custom_description: string | null; type: string }>;
  follow_ups?: { follow_up_date: string | null; instructions: string | null } | null;
}

// PostgREST returns to-one embeds as object|array — flatten to object.
function flattenConsultation(c: Record<string, unknown>): ConsultationRow {
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v) ?? null;
  const b = pick(c.bookings) as Record<string, unknown> | null;
  const d = pick(c.doctors) as Record<string, unknown> | null;
  const sa = d ? (pick(d.staff_accounts) as Record<string, unknown> | null) : null;
  const f = pick(c.follow_ups) as Record<string, unknown> | null;
  return {
    ...(c as unknown as ConsultationRow),
    bookings: b ? { appointment_date: (b.appointment_date as string) ?? null, doctor_id: (b.doctor_id as string) ?? null } : null,
    doctors: d ? { staff_accounts: sa ? { full_name: (sa.full_name as string) ?? null } : null } : null,
    consultation_diagnoses: (c.consultation_diagnoses as ConsultationRow["consultation_diagnoses"]) ?? [],
    follow_ups: f ? { follow_up_date: (f.follow_up_date as string) ?? null, instructions: (f.instructions as string) ?? null } : null,
  };
}

export async function queryConsultations(
  _supabase: unknown,
  f: { patientId?: string; doctorId?: string; bookingId?: string } = {},
): Promise<ConsultationRow[]> {
  const rows = await api.get<Record<string, unknown>[]>("/api/consultations", {
    query: { patientId: f.patientId, doctorId: f.doctorId, bookingId: f.bookingId },
  });
  return rows.map(flattenConsultation);
}

export async function queryConsultationById(
  _supabase: unknown,
  consultationId: string,
): Promise<ConsultationRow | null> {
  try {
    return flattenConsultation(await api.get<Record<string, unknown>>(`/api/consultations/${consultationId}`));
  } catch {
    return null;
  }
}

export async function queryConsultationByBooking(
  _supabase: unknown,
  bookingId: string,
): Promise<ConsultationRow | null> {
  try {
    return await api.get<ConsultationRow>(`/api/consultations/by-booking/${bookingId}`);
  } catch {
    return null;
  }
}

export interface ConsultationUpsert {
  patient_id: string;
  doctor_id: string;
  status: string;
  chief_complaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  doctor_notes?: string | null;
  // §16.6 — doctor picks the fee line at consultation; backend recomputes the
  // flat clinic fee on the linked booking. Omit to leave the booking untouched.
  visit_type?: "New" | "FollowUp" | null;
  med_cert_requested?: boolean | null;
  discount_category?: "Senior" | "PWD" | null;
}

export async function upsertConsultationByBooking(
  _supabase: unknown,
  bookingId: string,
  body: ConsultationUpsert,
): Promise<ConsultationRow> {
  return api.put<ConsultationRow>(`/api/consultations/by-booking/${bookingId}`, body);
}

// ── consultation_diagnoses ────────────────────────────────────────────────
export interface DiagnosisRow {
  id?: string;
  consultation_id?: string;
  icd10_code: string | null;
  custom_description: string | null;
  type: string;
  created_at?: string;
}

export async function queryDiagnoses(_supabase: unknown, consultationId: string): Promise<DiagnosisRow[]> {
  return api.get<DiagnosisRow[]>(`/api/consultations/${consultationId}/diagnoses`);
}

export async function replaceDiagnoses(
  _supabase: unknown,
  consultationId: string,
  diagnoses: Array<{ icd10_code: string | null; custom_description: string | null; type: string }>,
): Promise<void> {
  await api.put(`/api/consultations/${consultationId}/diagnoses`, diagnoses);
}

// ── patient_vital_readings ────────────────────────────────────────────────
export interface VitalReadingRow {
  id?: string;
  booking_id?: string;
  patient_id?: string;
  template_id: string;
  value: string;
  /** §16.1 — staff-like user who recorded the reading (set server-side). */
  recorded_by_user_id?: string | null;
}

export async function queryVitalReadings(
  _supabase: unknown,
  f: { bookingId?: string; patientId?: string },
): Promise<VitalReadingRow[]> {
  return api.get<VitalReadingRow[]>("/api/vitals", {
    query: { bookingId: f.bookingId, patientId: f.patientId },
  });
}

export async function upsertVitalsByBooking(
  _supabase: unknown,
  bookingId: string,
  _patientId: string,
  readings: Array<{ template_id: string; value: string }>,
): Promise<void> {
  await api.put(`/api/vitals/by-booking/${bookingId}`, readings);
}

// ── follow_ups ────────────────────────────────────────────────────────────
export interface FollowUpRow {
  id?: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  follow_up_date: string;
  reason: string | null;
  instructions: string | null;
  reminder_enabled: boolean;
  status: string;
}

export async function queryFollowUps(
  _supabase: unknown,
  f: { patientId?: string; doctorId?: string; consultationId?: string },
): Promise<FollowUpRow[]> {
  return api.get<FollowUpRow[]>("/api/follow-ups", {
    query: { patientId: f.patientId, doctorId: f.doctorId, consultationId: f.consultationId },
  });
}

export async function upsertFollowUpByConsultation(
  _supabase: unknown,
  consultationId: string,
  body: Omit<FollowUpRow, "id" | "consultation_id">,
): Promise<void> {
  await api.put(`/api/follow-ups/by-consultation/${consultationId}`, body);
}

export async function deleteFollowUpByConsultation(_supabase: unknown, consultationId: string): Promise<void> {
  await api.delete(`/api/follow-ups/by-consultation/${consultationId}`);
}

// ── medical_certificates (§16.8 Form 2) ──────────────────────────────────
export interface MedicalCertificateRow {
  certificate_id?: string;
  consultation_id?: string;
  patient_id: string;
  doctor_id: string;
  issue_date?: string | null;
  patient_address_snapshot?: string | null;
  examined_at?: string | null;
  examination_date_from?: string | null;
  examination_date_to?: string | null;
  diagnosis_text?: string | null;
  recommendations?: string | null;
  purpose_exception?: string | null;
  come_back_on?: string | null;
  issued_by_user_id?: string | null;
}

export async function queryMedicalCertificateByBooking(
  _supabase: unknown,
  bookingId: string,
): Promise<MedicalCertificateRow | null> {
  try {
    return await api.get<MedicalCertificateRow>(`/api/medical-certificates/by-booking/${bookingId}`);
  } catch {
    return null;
  }
}

export async function queryMedicalCertificateByConsultation(
  _supabase: unknown,
  consultationId: string,
): Promise<MedicalCertificateRow | null> {
  try {
    return await api.get<MedicalCertificateRow>(`/api/medical-certificates/by-consultation/${consultationId}`);
  } catch {
    return null;
  }
}

export async function upsertMedicalCertificateByConsultation(
  _supabase: unknown,
  consultationId: string,
  body: MedicalCertificateRow,
): Promise<MedicalCertificateRow> {
  return api.put<MedicalCertificateRow>(`/api/medical-certificates/by-consultation/${consultationId}`, body);
}

export async function deleteMedicalCertificateByConsultation(
  _supabase: unknown,
  consultationId: string,
): Promise<void> {
  await api.delete(`/api/medical-certificates/by-consultation/${consultationId}`);
}

// ── prescriptions ─────────────────────────────────────────────────────────
export interface RxItem {
  id?: string;
  group_id?: string;
  template_id?: string;
  medicine_id: string;
  generic_name: string;
  dosage: string;
  quantity: string;
  instruction: string | null;
  is_controlled_substance: boolean;
  // §16.8 Form 1 — structured Rx-pad fields (line items only; all optional).
  timing?: string | null;
  meal_relation?: string | null;
  duration_kind?: string | null;
  duration_value?: number | null;
  indication?: string | null;
  created_at?: string;
}
export interface RxGroupRow {
  group_id: string;
  patient_id: string;
  doctor_id: string;
  booking_id: string;
  created_at: string;
  updated_at: string;
  prescription_line_items: RxItem[];
  bookings?: {
    appointment_date: string | null;
    doctors?: { staff_accounts: { full_name: string | null } | null } | null;
  } | null;
}

function flattenRxGroup(g: Record<string, unknown>): RxGroupRow {
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v) ?? null;
  const b = pick(g.bookings) as Record<string, unknown> | null;
  const d = b ? (pick(b.doctors) as Record<string, unknown> | null) : null;
  const sa = d ? (pick(d.staff_accounts) as Record<string, unknown> | null) : null;
  return {
    ...(g as unknown as RxGroupRow),
    prescription_line_items: (g.prescription_line_items as RxItem[]) ?? [],
    bookings: b
      ? {
          appointment_date: (b.appointment_date as string) ?? null,
          doctors: d ? { staff_accounts: sa ? { full_name: (sa.full_name as string) ?? null } : null } : null,
        }
      : null,
  };
}

export async function queryRxGroups(
  _supabase: unknown,
  f: { patientId?: string; bookingId?: string; doctorId?: string },
): Promise<RxGroupRow[]> {
  const rows = await api.get<Record<string, unknown>[]>("/api/prescription-groups", {
    query: { patientId: f.patientId, bookingId: f.bookingId, doctorId: f.doctorId },
  });
  return rows.map(flattenRxGroup);
}

export async function queryRxGroupById(_supabase: unknown, groupId: string): Promise<RxGroupRow | null> {
  try {
    return flattenRxGroup(await api.get<Record<string, unknown>>(`/api/prescription-groups/${groupId}`));
  } catch {
    return null;
  }
}

export async function upsertRxGroupByBooking(
  _supabase: unknown,
  bookingId: string,
  body: { patient_id: string; doctor_id: string; items: Omit<RxItem, "id">[] },
): Promise<RxGroupRow> {
  return api.put<RxGroupRow>(`/api/prescription-groups/by-booking/${bookingId}`, {
    patient_id: body.patient_id,
    doctor_id: body.doctor_id,
    booking_id: bookingId,
    items: body.items,
  });
}

export async function deleteRxGroup(_supabase: unknown, groupId: string): Promise<void> {
  await api.delete(`/api/prescription-groups/${groupId}`);
}

export interface RxTemplateRow {
  template_id: string;
  doctor_id: string;
  title: string;
  is_system_template: boolean;
  prescription_template_items: RxItem[];
}

export async function queryRxTemplates(_supabase: unknown, doctorId?: string): Promise<RxTemplateRow[]> {
  return api.get<RxTemplateRow[]>("/api/prescription-templates", { query: { doctorId } });
}

export interface FavoriteMedicineRow {
  id: string;
  doctor_id: string;
  medicine_id: string;
  generic_name: string;
  dosage: string;
  quantity: string;
  instruction: string | null;
}

export async function queryFavoriteMedicines(_supabase: unknown, doctorId: string): Promise<FavoriteMedicineRow[]> {
  return api.get<FavoriteMedicineRow[]>("/api/doctor-favorite-medicines", { query: { doctorId } });
}

// ── soap ──────────────────────────────────────────────────────────────────
export interface SoapTemplateRow {
  id: string;
  doctor_id: string;
  title: string;
  is_system_template: boolean;
  chief_complaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}
export interface SoapPhraseRow {
  id: string;
  doctor_id: string;
  field: string;
  label: string;
  body: string;
}

export async function querySoapTemplates(_supabase: unknown, doctorId?: string): Promise<SoapTemplateRow[]> {
  return api.get<SoapTemplateRow[]>("/api/soap-templates", { query: { doctorId } });
}

export async function querySoapPhrases(_supabase: unknown, doctorId: string): Promise<SoapPhraseRow[]> {
  return api.get<SoapPhraseRow[]>("/api/soap-phrases", { query: { doctorId } });
}

export async function createSoapPhrase(
  _supabase: unknown,
  doctorId: string,
  input: { field: string; label: string; body: string },
): Promise<SoapPhraseRow> {
  return api.post<SoapPhraseRow>("/api/soap-phrases", input, { query: { doctorId } });
}

export async function updateSoapPhrase(
  _supabase: unknown,
  id: string,
  input: { field: string; label: string; body: string },
): Promise<SoapPhraseRow> {
  return api.put<SoapPhraseRow>(`/api/soap-phrases/${id}`, input);
}

export async function deleteSoapPhrase(_supabase: unknown, id: string): Promise<void> {
  await api.delete(`/api/soap-phrases/${id}`);
}

export async function createSoapTemplate(
  _supabase: unknown,
  doctorId: string,
  input: Omit<SoapTemplateRow, "id" | "doctor_id">,
): Promise<SoapTemplateRow> {
  return api.post<SoapTemplateRow>("/api/soap-templates", input, { query: { doctorId } });
}

export async function updateSoapTemplate(
  _supabase: unknown,
  id: string,
  input: Omit<SoapTemplateRow, "id" | "doctor_id">,
): Promise<SoapTemplateRow> {
  return api.put<SoapTemplateRow>(`/api/soap-templates/${id}`, input);
}

export async function deleteSoapTemplate(_supabase: unknown, id: string): Promise<void> {
  await api.delete(`/api/soap-templates/${id}`);
}

// ── doctor_diagnosis_templates ────────────────────────────────────────────
// Reusable free-text diagnoses (§16.8). Always scoped to the logged-in doctor
// by the API (JWT sub → staff_accounts); no doctorId needed from the FE.
export interface DiagnosisTemplateRow {
  id: string;
  doctor_id: string;
  label: string;
  body: string;
}

export async function queryDiagnosisTemplates(_supabase?: unknown): Promise<DiagnosisTemplateRow[]> {
  return api.get<DiagnosisTemplateRow[]>("/api/doctor-diagnosis-templates");
}

export async function createDiagnosisTemplate(
  _supabase: unknown,
  input: { label: string; body: string },
): Promise<DiagnosisTemplateRow> {
  return api.post<DiagnosisTemplateRow>("/api/doctor-diagnosis-templates", input);
}

export async function updateDiagnosisTemplate(
  _supabase: unknown,
  id: string,
  input: { label: string; body: string },
): Promise<DiagnosisTemplateRow> {
  return api.put<DiagnosisTemplateRow>(`/api/doctor-diagnosis-templates/${id}`, input);
}

export async function deleteDiagnosisTemplate(_supabase: unknown, id: string): Promise<void> {
  await api.delete(`/api/doctor-diagnosis-templates/${id}`);
}

export async function createRxTemplate(
  _supabase: unknown,
  doctorId: string,
  input: { title: string; is_system_template: boolean; items: Omit<RxItem, "id">[] },
): Promise<RxTemplateRow> {
  return api.post<RxTemplateRow>("/api/prescription-templates", {
    doctor_id: doctorId,
    title: input.title,
    is_system_template: input.is_system_template,
    items: input.items,
  });
}

/** Edit = replace (title + items), atomic via PUT /api/prescription-templates/{id}. */
export async function updateRxTemplate(
  _supabase: unknown,
  templateId: string,
  doctorId: string,
  input: { title: string; is_system_template: boolean; items: Omit<RxItem, "id">[] },
): Promise<RxTemplateRow> {
  return api.put<RxTemplateRow>(`/api/prescription-templates/${templateId}`, {
    doctor_id: doctorId,
    title: input.title,
    is_system_template: input.is_system_template,
    items: input.items,
  });
}

export async function deleteRxTemplate(_supabase: unknown, templateId: string): Promise<void> {
  await api.delete(`/api/prescription-templates/${templateId}`);
}

export async function addFavoriteMedicine(
  _supabase: unknown,
  doctorId: string,
  input: Omit<FavoriteMedicineRow, "id" | "doctor_id">,
): Promise<FavoriteMedicineRow> {
  return api.post<FavoriteMedicineRow>("/api/doctor-favorite-medicines", input, { query: { doctorId } });
}

export async function updateFavoriteMedicine(
  _supabase: unknown,
  id: string,
  input: Omit<FavoriteMedicineRow, "id" | "doctor_id">,
): Promise<FavoriteMedicineRow> {
  return api.put<FavoriteMedicineRow>(`/api/doctor-favorite-medicines/${id}`, input);
}

export async function deleteFavoriteMedicine(_supabase: unknown, id: string): Promise<void> {
  await api.delete(`/api/doctor-favorite-medicines/${id}`);
}

// ── audit_logs write ──────────────────────────────────────────────────────
export async function writeAuditLog(
  _supabase: unknown,
  entry: { entity_type: string; entity_id: string; action: string; details?: string | null },
): Promise<void> {
  await api.post("/api/audit-logs", entry);
}
