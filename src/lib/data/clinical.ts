/**
 * Clinical resources (INTEGRATION_ROADMAP.md Phase 5): consultations,
 * consultation_diagnoses, patient_vital_readings, follow_ups, prescription_*,
 * soap_*, audit_logs write.
 *
 * Canonical §4/§6 shapes from either backend, resolveMode-gated per resource.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode, type DataResource } from "./mode";

const dn = (r: DataResource) => resolveMode(r) === "dotnet";

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

const CONSULT_EMBED =
  "*, bookings(appointment_date, doctor_id), doctors(staff_accounts(full_name)), consultation_diagnoses(custom_description, type), follow_ups(follow_up_date, instructions)";

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
  supabase: SupabaseClient,
  f: { patientId?: string; doctorId?: string; bookingId?: string } = {},
): Promise<ConsultationRow[]> {
  if (dn("consultations")) {
    const rows = await api.get<Record<string, unknown>[]>("/api/consultations", {
      query: { patientId: f.patientId, doctorId: f.doctorId, bookingId: f.bookingId },
    });
    return rows.map(flattenConsultation);
  }
  let q = supabase.from("consultations").select(CONSULT_EMBED);
  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.doctorId) q = q.eq("doctor_id", f.doctorId);
  if (f.bookingId) q = q.eq("booking_id", f.bookingId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []).map((r) => flattenConsultation(r as Record<string, unknown>));
}

export async function queryConsultationById(
  supabase: SupabaseClient,
  consultationId: string,
): Promise<ConsultationRow | null> {
  if (dn("consultations")) {
    try {
      return flattenConsultation(await api.get<Record<string, unknown>>(`/api/consultations/${consultationId}`));
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("consultations").select(CONSULT_EMBED).eq("consultation_id", consultationId).maybeSingle();
  return data ? flattenConsultation(data as Record<string, unknown>) : null;
}

export async function queryConsultationByBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<ConsultationRow | null> {
  if (dn("consultations")) {
    try {
      return await api.get<ConsultationRow>(`/api/consultations/by-booking/${bookingId}`);
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("consultations").select("*").eq("booking_id", bookingId).maybeSingle();
  return (data as ConsultationRow) ?? null;
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
  supabase: SupabaseClient,
  bookingId: string,
  body: ConsultationUpsert,
): Promise<ConsultationRow> {
  if (dn("consultations")) {
    return api.put<ConsultationRow>(`/api/consultations/by-booking/${bookingId}`, body);
  }
  // Supabase fallback: strip the booking-only fee fields — they don't exist on
  // the `consultations` table (the .NET endpoint applies them to the booking).
  const { visit_type: _vt, med_cert_requested: _mc, discount_category: _dc, ...consultBody } = body;
  const { data } = await supabase
    .from("consultations")
    .upsert({ booking_id: bookingId, ...consultBody }, { onConflict: "booking_id" })
    .select("*")
    .single();
  return data as ConsultationRow;
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

export async function queryDiagnoses(supabase: SupabaseClient, consultationId: string): Promise<DiagnosisRow[]> {
  if (dn("consultation_diagnoses")) {
    return api.get<DiagnosisRow[]>(`/api/consultations/${consultationId}/diagnoses`);
  }
  const { data } = await supabase.from("consultation_diagnoses").select("*").eq("consultation_id", consultationId);
  return (data ?? []) as DiagnosisRow[];
}

export async function replaceDiagnoses(
  supabase: SupabaseClient,
  consultationId: string,
  diagnoses: Array<{ icd10_code: string | null; custom_description: string | null; type: string }>,
): Promise<void> {
  if (dn("consultation_diagnoses")) {
    await api.put(`/api/consultations/${consultationId}/diagnoses`, diagnoses);
    return;
  }
  await supabase.from("consultation_diagnoses").delete().eq("consultation_id", consultationId);
  if (diagnoses.length) {
    await supabase
      .from("consultation_diagnoses")
      .insert(diagnoses.map((d) => ({ ...d, consultation_id: consultationId })));
  }
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
  supabase: SupabaseClient,
  f: { bookingId?: string; patientId?: string },
): Promise<VitalReadingRow[]> {
  if (dn("patient_vital_readings")) {
    return api.get<VitalReadingRow[]>("/api/vitals", {
      query: { bookingId: f.bookingId, patientId: f.patientId },
    });
  }
  let q = supabase.from("patient_vital_readings").select("*");
  if (f.bookingId) q = q.eq("booking_id", f.bookingId);
  if (f.patientId) q = q.eq("patient_id", f.patientId);
  const { data } = await q;
  return (data ?? []) as VitalReadingRow[];
}

export async function upsertVitalsByBooking(
  supabase: SupabaseClient,
  bookingId: string,
  patientId: string,
  readings: Array<{ template_id: string; value: string }>,
): Promise<void> {
  if (dn("patient_vital_readings")) {
    await api.put(`/api/vitals/by-booking/${bookingId}`, readings);
    return;
  }
  const nonEmpty = readings.filter((r) => r.value.trim() !== "");
  const empty = readings.filter((r) => r.value.trim() === "").map((r) => r.template_id);
  if (nonEmpty.length) {
    await supabase.from("patient_vital_readings").upsert(
      nonEmpty.map((r) => ({ booking_id: bookingId, patient_id: patientId, ...r })),
      { onConflict: "booking_id,template_id" },
    );
  }
  if (empty.length) {
    await supabase
      .from("patient_vital_readings")
      .delete()
      .eq("booking_id", bookingId)
      .in("template_id", empty);
  }
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
  supabase: SupabaseClient,
  f: { patientId?: string; doctorId?: string; consultationId?: string },
): Promise<FollowUpRow[]> {
  if (dn("follow_ups")) {
    return api.get<FollowUpRow[]>("/api/follow-ups", {
      query: { patientId: f.patientId, doctorId: f.doctorId, consultationId: f.consultationId },
    });
  }
  let q = supabase.from("follow_ups").select("*");
  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.doctorId) q = q.eq("doctor_id", f.doctorId);
  if (f.consultationId) q = q.eq("consultation_id", f.consultationId);
  const { data } = await q.order("follow_up_date");
  return (data ?? []) as FollowUpRow[];
}

export async function upsertFollowUpByConsultation(
  supabase: SupabaseClient,
  consultationId: string,
  body: Omit<FollowUpRow, "id" | "consultation_id">,
): Promise<void> {
  if (dn("follow_ups")) {
    await api.put(`/api/follow-ups/by-consultation/${consultationId}`, body);
    return;
  }
  await supabase
    .from("follow_ups")
    .upsert({ consultation_id: consultationId, ...body }, { onConflict: "consultation_id" });
}

export async function deleteFollowUpByConsultation(supabase: SupabaseClient, consultationId: string): Promise<void> {
  if (dn("follow_ups")) {
    await api.delete(`/api/follow-ups/by-consultation/${consultationId}`);
    return;
  }
  await supabase.from("follow_ups").delete().eq("consultation_id", consultationId);
}

// ── medical_certificates (§16.8 Form 2) — .NET-only, no Supabase table ────
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
  _supabase: SupabaseClient,
  bookingId: string,
): Promise<MedicalCertificateRow | null> {
  try {
    return await api.get<MedicalCertificateRow>(`/api/medical-certificates/by-booking/${bookingId}`);
  } catch {
    return null;
  }
}

export async function queryMedicalCertificateByConsultation(
  _supabase: SupabaseClient,
  consultationId: string,
): Promise<MedicalCertificateRow | null> {
  try {
    return await api.get<MedicalCertificateRow>(`/api/medical-certificates/by-consultation/${consultationId}`);
  } catch {
    return null;
  }
}

export async function upsertMedicalCertificateByConsultation(
  _supabase: SupabaseClient,
  consultationId: string,
  body: MedicalCertificateRow,
): Promise<MedicalCertificateRow> {
  return api.put<MedicalCertificateRow>(`/api/medical-certificates/by-consultation/${consultationId}`, body);
}

export async function deleteMedicalCertificateByConsultation(
  _supabase: SupabaseClient,
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

const RX_EMBED = "*, prescription_line_items(*), bookings(appointment_date, doctors(staff_accounts(full_name)))";

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
  supabase: SupabaseClient,
  f: { patientId?: string; bookingId?: string; doctorId?: string },
): Promise<RxGroupRow[]> {
  if (dn("prescription_groups")) {
    const rows = await api.get<Record<string, unknown>[]>("/api/prescription-groups", {
      query: { patientId: f.patientId, bookingId: f.bookingId, doctorId: f.doctorId },
    });
    return rows.map(flattenRxGroup);
  }
  let q = supabase.from("prescription_groups").select(RX_EMBED);
  if (f.patientId) q = q.eq("patient_id", f.patientId);
  if (f.bookingId) q = q.eq("booking_id", f.bookingId);
  if (f.doctorId) q = q.eq("doctor_id", f.doctorId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []).map((r) => flattenRxGroup(r as Record<string, unknown>));
}

export async function upsertRxGroupByBooking(
  supabase: SupabaseClient,
  bookingId: string,
  body: { patient_id: string; doctor_id: string; items: Omit<RxItem, "id">[] },
): Promise<RxGroupRow> {
  if (dn("prescription_groups")) {
    return api.put<RxGroupRow>(`/api/prescription-groups/by-booking/${bookingId}`, {
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      booking_id: bookingId,
      items: body.items,
    });
  }
  const { data: group } = await supabase
    .from("prescription_groups")
    .upsert({ booking_id: bookingId, patient_id: body.patient_id, doctor_id: body.doctor_id }, { onConflict: "booking_id" })
    .select("*")
    .single();
  await supabase.from("prescription_line_items").delete().eq("group_id", group!.group_id);
  if (body.items.length) {
    await supabase
      .from("prescription_line_items")
      .insert(body.items.map((i) => ({ ...i, group_id: group!.group_id })));
  }
  const { data } = await supabase
    .from("prescription_groups")
    .select("*, prescription_line_items(*)")
    .eq("group_id", group!.group_id)
    .single();
  return data as RxGroupRow;
}

export interface RxTemplateRow {
  template_id: string;
  doctor_id: string;
  title: string;
  is_system_template: boolean;
  prescription_template_items: RxItem[];
}

export async function queryRxTemplates(supabase: SupabaseClient, doctorId?: string): Promise<RxTemplateRow[]> {
  if (dn("prescription_templates")) {
    return api.get<RxTemplateRow[]>("/api/prescription-templates", { query: { doctorId } });
  }
  let q = supabase.from("prescription_templates").select("*, prescription_template_items(*)");
  if (doctorId) q = q.or(`doctor_id.eq.${doctorId},is_system_template.eq.true`);
  const { data } = await q.order("title");
  return (data ?? []) as RxTemplateRow[];
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

export async function queryFavoriteMedicines(supabase: SupabaseClient, doctorId: string): Promise<FavoriteMedicineRow[]> {
  if (dn("doctor_favorite_medicines")) {
    return api.get<FavoriteMedicineRow[]>("/api/doctor-favorite-medicines", { query: { doctorId } });
  }
  const { data } = await supabase
    .from("doctor_favorite_medicines")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("generic_name");
  return (data ?? []) as FavoriteMedicineRow[];
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

export async function querySoapTemplates(supabase: SupabaseClient, doctorId?: string): Promise<SoapTemplateRow[]> {
  if (dn("soap_templates")) {
    return api.get<SoapTemplateRow[]>("/api/soap-templates", { query: { doctorId } });
  }
  let q = supabase.from("soap_templates").select("*");
  if (doctorId) q = q.or(`doctor_id.eq.${doctorId},is_system_template.eq.true`);
  const { data } = await q.order("title");
  return (data ?? []) as SoapTemplateRow[];
}

export async function querySoapPhrases(supabase: SupabaseClient, doctorId: string): Promise<SoapPhraseRow[]> {
  if (dn("soap_phrases")) {
    return api.get<SoapPhraseRow[]>("/api/soap-phrases", { query: { doctorId } });
  }
  const { data } = await supabase.from("soap_phrases").select("*").eq("doctor_id", doctorId);
  return (data ?? []) as SoapPhraseRow[];
}

export async function createSoapPhrase(
  supabase: SupabaseClient,
  doctorId: string,
  input: { field: string; label: string; body: string },
): Promise<SoapPhraseRow> {
  if (dn("soap_phrases")) {
    return api.post<SoapPhraseRow>("/api/soap-phrases", input, { query: { doctorId } });
  }
  const { data } = await supabase
    .from("soap_phrases")
    .insert({ doctor_id: doctorId, ...input })
    .select("*")
    .single();
  return data as SoapPhraseRow;
}

export async function deleteSoapPhrase(supabase: SupabaseClient, id: string): Promise<void> {
  if (dn("soap_phrases")) {
    await api.delete(`/api/soap-phrases/${id}`);
    return;
  }
  await supabase.from("soap_phrases").delete().eq("id", id);
}

export async function createSoapTemplate(
  supabase: SupabaseClient,
  doctorId: string,
  input: Omit<SoapTemplateRow, "id" | "doctor_id">,
): Promise<SoapTemplateRow> {
  if (dn("soap_templates")) {
    return api.post<SoapTemplateRow>("/api/soap-templates", input, { query: { doctorId } });
  }
  const { data } = await supabase
    .from("soap_templates")
    .insert({ doctor_id: doctorId, ...input })
    .select("*")
    .single();
  return data as SoapTemplateRow;
}

export async function deleteSoapTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  if (dn("soap_templates")) {
    await api.delete(`/api/soap-templates/${id}`);
    return;
  }
  await supabase.from("soap_templates").delete().eq("id", id);
}

export async function createRxTemplate(
  supabase: SupabaseClient,
  doctorId: string,
  input: { title: string; is_system_template: boolean; items: Omit<RxItem, "id">[] },
): Promise<RxTemplateRow> {
  if (dn("prescription_templates")) {
    return api.post<RxTemplateRow>("/api/prescription-templates", {
      doctor_id: doctorId,
      title: input.title,
      is_system_template: input.is_system_template,
      items: input.items,
    });
  }
  const { data: t } = await supabase
    .from("prescription_templates")
    .insert({ doctor_id: doctorId, title: input.title, is_system_template: input.is_system_template })
    .select("*")
    .single();
  if (input.items.length) {
    await supabase
      .from("prescription_template_items")
      .insert(input.items.map((i) => ({ ...i, template_id: t!.template_id })));
  }
  const { data } = await supabase
    .from("prescription_templates")
    .select("*, prescription_template_items(*)")
    .eq("template_id", t!.template_id)
    .single();
  return data as RxTemplateRow;
}

/** Edit = replace (title + items). .NET has no template PUT; delete + recreate. */
export async function updateRxTemplate(
  supabase: SupabaseClient,
  templateId: string,
  doctorId: string,
  input: { title: string; is_system_template: boolean; items: Omit<RxItem, "id">[] },
): Promise<RxTemplateRow> {
  if (dn("prescription_templates")) {
    await deleteRxTemplate(supabase, templateId);
    return createRxTemplate(supabase, doctorId, input);
  }
  await supabase.from("prescription_templates").update({ title: input.title }).eq("template_id", templateId);
  await supabase.from("prescription_template_items").delete().eq("template_id", templateId);
  if (input.items.length) {
    await supabase
      .from("prescription_template_items")
      .insert(input.items.map((i) => ({ ...i, template_id: templateId })));
  }
  const { data } = await supabase
    .from("prescription_templates")
    .select("*, prescription_template_items(*)")
    .eq("template_id", templateId)
    .single();
  return data as RxTemplateRow;
}

export async function deleteRxTemplate(supabase: SupabaseClient, templateId: string): Promise<void> {
  if (dn("prescription_templates")) {
    await api.delete(`/api/prescription-templates/${templateId}`);
    return;
  }
  await supabase.from("prescription_templates").delete().eq("template_id", templateId);
}

export async function addFavoriteMedicine(
  supabase: SupabaseClient,
  doctorId: string,
  input: Omit<FavoriteMedicineRow, "id" | "doctor_id">,
): Promise<FavoriteMedicineRow> {
  if (dn("doctor_favorite_medicines")) {
    return api.post<FavoriteMedicineRow>("/api/doctor-favorite-medicines", input, { query: { doctorId } });
  }
  const { data } = await supabase
    .from("doctor_favorite_medicines")
    .insert({ doctor_id: doctorId, ...input })
    .select("*")
    .single();
  return data as FavoriteMedicineRow;
}

export async function deleteFavoriteMedicine(supabase: SupabaseClient, id: string): Promise<void> {
  if (dn("doctor_favorite_medicines")) {
    await api.delete(`/api/doctor-favorite-medicines/${id}`);
    return;
  }
  await supabase.from("doctor_favorite_medicines").delete().eq("id", id);
}

// ── audit_logs write ──────────────────────────────────────────────────────
export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: { entity_type: string; entity_id: string; action: string; details?: string | null },
): Promise<void> {
  if (dn("audit_logs")) {
    await api.post("/api/audit-logs", entry);
    return;
  }
  await supabase.from("audit_logs").insert(entry);
}
