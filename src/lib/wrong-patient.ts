//JJQR - AI (2026-11-26) - GAV-11: "Wrong patient?" — the front desk checked a different person in under an existing patient. The doctor moves THIS ONE
// visit (and everything recorded in it, payment/OR included) to a new or an existing patient. Rules for the dialog; plain module (no React, no "@/"
// imports) so node:test can check it (wrong-patient.test.mjs). Server: POST /api/bookings/{id}/reassign-patient (+ GET reassign-preview).

import { patchFromForm, patientEditProblem, type PatientEditForm } from "./patient-edit.ts";

export type WrongPatientMode = "new" | "existing";

export interface ReassignAllergy {
  id: string;
  allergen: string;
  reaction?: string | null;
  severity?: string | null;
  is_nkda: boolean;
  added_during_visit: boolean;
}

export interface ReassignPreview {
  booking_id: string;
  appointment_date: string;
  queue_number: string | null;
  status: string;
  consultation_id: string | null;
  consultation_status: string | null;
  payment_status: string | null;
  or_number: string | null;
  patient: { patient_id: string; patient_code: string; first_name: string; last_name: string };
  allergies: ReassignAllergy[];
  counts: Record<string, number>;
  target: null | {
    patient_id: string; patient_code: string; first_name: string; last_name: string; date_of_birth: string;
    unavailable: boolean; has_visit_that_day: boolean; visits_that_day: { booking_id: string; queue_number: string | null; status: string }[];
  };
}

export interface ReassignResult {
  booking_id: string;
  from_patient_id: string | null;
  from_patient_code?: string;
  to_patient_id: string;
  patient_code: string;
  queue_number?: string | null;
  appointment_date?: string;
  allergies_moved?: number;
  already: boolean;
}

export const EMPTY_NEW_PATIENT: PatientEditForm = {
  firstName: "", middleName: "", lastName: "", dateOfBirth: "", sex: "Male", civilStatus: "", contactNumber: "", address: "", city: "", zipCode: "",
  bloodType: "", philhealthNumber: "", hmoProvider: "", hmoCardNumber: "", emergencyContactName: "", emergencyContactNumber: "", emergencyContactRelationship: "",
};

/** Allergies ticked when the dialog opens: the ones recorded during this visit (owner: they move with it by default). */
export function defaultAllergyIds(allergies: ReassignAllergy[]): string[] {
  return allergies.filter((a) => a.added_during_visit).map((a) => a.id);
}

/** First thing to fix before Confirm, or null. */
export function wrongPatientProblem(
  input: { mode: WrongPatientMode; form: PatientEditForm; targetId: string | null; currentPatientId: string; reason: string },
  today: string,
): string | null {
  if (input.mode === "new") {
    const p = patientEditProblem(input.form, today);
    if (p) return p.message;
  } else {
    if (!input.targetId) return "Search for and choose the patient this visit belongs to.";
    if (input.targetId === input.currentPatientId) return "This visit is already under that patient. Choose a different person.";
  }
  if (input.reason.trim().length < 5) return "Write why (at least 5 characters), e.g. \"Different person, same name\".";
  if (input.reason.trim().length > 500) return "The reason is too long (500 characters at most).";
  return null;
}

/** Body for POST /api/bookings/{id}/reassign-patient. newPatientId is made once per dialog so a retry can never create two patients. */
export function reassignBody(input: {
  mode: WrongPatientMode; form: PatientEditForm; newPatientId: string; targetId: string | null; reason: string; allergyIds: string[];
  ackSameDay?: boolean; ackDuplicate?: boolean;
}) {
  return {
    mode: input.mode,
    reason: input.reason.trim(),
    move_allergy_ids: input.allergyIds,
    acknowledge_same_day_visit: Boolean(input.ackSameDay),
    acknowledge_possible_duplicate: Boolean(input.ackDuplicate),
    ...(input.mode === "new"
      ? { new_patient: { patient_id: input.newPatientId, email: "", ...patchFromForm(input.form) } }
      : { target_patient_id: input.targetId }),
  };
}

export type ReassignWarning =
  | { kind: "same_day"; message: string; queueNumbers: string[] }
  | { kind: "duplicate"; message: string; matches: { patient_id: string; patient_code: string; first_name: string; last_name: string; date_of_birth: string }[] };

/** A 409 the doctor can answer ("move anyway" / "use that patient") instead of a plain error; null for anything else. */
export function warningFrom(status: number, body: unknown): ReassignWarning | null {
  if (status !== 409 || !body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.error === "target_has_visit_that_day") {
    const visits = Array.isArray(b.visits) ? (b.visits as { queue_number?: string | null }[]) : [];
    return { kind: "same_day", message: String(b.message ?? "That patient already has a visit that day."), queueNumbers: visits.map((v) => v.queue_number ?? "").filter(Boolean) };
  }
  if (b.error === "possible_duplicate") {
    return { kind: "duplicate", message: String(b.message ?? "A patient with this name and birthday is already on file."), matches: Array.isArray(b.matches) ? (b.matches as never) : [] };
  }
  return null;
}

/** One line for the dialog: what moves with the visit. */
export function movesSummary(p: Pick<ReassignPreview, "counts" | "payment_status" | "or_number" | "queue_number">): string {
  const label: Record<string, string> = {
    consultations: "consultation notes", prescriptions: "prescription", lab_orders: "lab orders", medical_certificates: "medical certificate",
    follow_ups: "follow-up", vitals: "vitals", vaccinations: "vaccinations", documents: "uploaded files", lab_results: "lab results", reviews: "review",
  };
  const parts = Object.entries(p.counts ?? {}).filter(([k, n]) => n > 0 && label[k]).map(([k]) => label[k]);
  if (p.payment_status && p.payment_status !== "Unpaid") parts.push(p.or_number ? `payment (OR ${p.or_number})` : "payment");
  else if (p.counts?.payments) parts.push("bill");
  return parts.length ? `Moves with it: ${parts.join(", ")}.` : "Only the visit itself moves (nothing recorded yet).";
}

/** The reprinted queue slip (no automatic reprint; owner: a "Reprint slip" button after the move). */
export function slipHtml(x: { queueNumber: string; patientName: string; patientCode: string; date: string }, esc: (s: string) => string): string {
  return `<div class="slip">
    <div class="queue">${esc(x.queueNumber)}</div>
    <p><strong>${esc(x.patientName)}</strong> (${esc(x.patientCode)})</p>
    <p class="muted">${esc(x.date)}</p>
    <p class="muted">Reprinted after correcting the patient</p>
  </div>`;
}
//JJQR - END
