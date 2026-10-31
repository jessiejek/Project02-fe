//JJQR - AI (Oct 31, 2026)
/**
 * Client-side print helpers for a booking's Rx and lab orders (loads live clinic/doctor/patient via authenticated API).
 */
import { queryClinicSettings } from "@/lib/data/admin";
import { queryBookingById } from "@/lib/data/bookings";
import {
  formatConsultationDiagnosisLabel,
  queryConsultationByBooking,
  queryDiagnoses,
  queryRxGroups,
  type RxGroupRow,
} from "@/lib/data/clinical";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryLabOrdersByBooking } from "@/lib/data/labs";
import { queryLabTestCatalog } from "@/lib/data/lookups";
import { queryPatientById } from "@/lib/data/patients";
import { printLabRequest, printPrescription, type PrintClinic, type PrintDoctor, type PrintPatient, type RxLine } from "@/lib/print-forms";

const supabase = null as never;

function clinicFromRow(row: Awaited<ReturnType<typeof queryClinicSettings>>): PrintClinic {
  return row
    ? { clinic_name: row.clinic_name, address: row.address, contact_number: row.contact_number }
    : { clinic_name: "Grace Medical Clinic", address: "", contact_number: null };
}

function doctorFromRow(
  doc: Awaited<ReturnType<typeof queryDoctorById>>,
  fallbackName: string,
): PrintDoctor {
  return {
    full_name: doc?.staff_accounts?.full_name ?? fallbackName,
    license_number: doc?.license_number ?? null,
    ptr_number: doc?.ptr_number ?? null,
    s2_number: doc?.s2_number ?? null,
  };
}

function patientFromRow(
  pat: Awaited<ReturnType<typeof queryPatientById>>,
  fallbackName: string,
): PrintPatient {
  return pat
    ? {
        full_name: `${pat.first_name} ${pat.last_name}`.trim(),
        patient_code: pat.patient_code,
        date_of_birth: pat.date_of_birth ?? null,
        sex: pat.sex ?? null,
        address: pat.address ?? null,
      }
    : { full_name: fallbackName };
}

function rxLinesFromGroup(g: RxGroupRow | undefined): RxLine[] {
  return (g?.prescription_line_items ?? []).map((i) => ({
    generic_name: i.generic_name,
    dosage: i.dosage,
    quantity: i.quantity,
    instruction: i.instruction ?? null,
    timing: i.timing ?? null,
    meal_relation: i.meal_relation ?? null,
    duration_kind: i.duration_kind ?? null,
    duration_value: i.duration_value ?? null,
    indication: i.indication ?? null,
    is_controlled_substance: i.is_controlled_substance,
    route: i.route ?? null,
  }));
}

export function diagnosisLabelsFromConsult(
  consult: Awaited<ReturnType<typeof queryConsultationByBooking>>,
  diagRows: Awaited<ReturnType<typeof queryDiagnoses>>,
): string[] {
  const fromEmbed = (consult?.consultation_diagnoses ?? [])
    .map((d) => formatConsultationDiagnosisLabel(d))
    .filter(Boolean);
  if (fromEmbed.length) return fromEmbed;
  return diagRows
    .map((d) => formatConsultationDiagnosisLabel(d))
    .filter(Boolean);
}

export function clinicalNotesFromConsult(consult: Awaited<ReturnType<typeof queryConsultationByBooking>>): string {
  if (!consult) return "";
  return [consult.assessment, consult.plan].filter(Boolean).join("\n");
}

export async function loadBookingPrintAvailability(bookingId: string): Promise<{ hasRx: boolean; hasLabs: boolean }> {
  const [rxGroups, labOrders] = await Promise.all([
    queryRxGroups(supabase, { bookingId }),
    queryLabOrdersByBooking(supabase, bookingId),
  ]);
  return {
    hasRx: (rxGroups[0]?.prescription_line_items?.length ?? 0) > 0,
    hasLabs: labOrders.some((l) => l.test_name.trim()),
  };
}

export async function printPrescriptionForBooking(
  bookingId: string,
  opts?: { date?: string; items?: RxLine[] },
): Promise<boolean> {
  const booking = await queryBookingById(supabase, bookingId);
  if (!booking) return false;

  const patientName = booking.patients
    ? `${booking.patients.first_name} ${booking.patients.last_name}`.trim()
    : "Patient";
  const doctorName = booking.doctors?.staff_accounts?.full_name ?? "";

  const [clinicRow, doctor, patient, rxGroups] = await Promise.all([
    queryClinicSettings(supabase),
    queryDoctorById(supabase, booking.doctor_id),
    queryPatientById(supabase, booking.patient_id),
    opts?.items ? Promise.resolve([] as RxGroupRow[]) : queryRxGroups(supabase, { bookingId }),
  ]);

  const items = opts?.items ?? rxLinesFromGroup(rxGroups[0]);
  if (items.length === 0) return false;

  return printPrescription({
    clinic: clinicFromRow(clinicRow),
    doctor: doctorFromRow(doctor, doctorName),
    patient: patientFromRow(patient, patientName),
    items,
    date: opts?.date ?? booking.appointment_date,
  });
}

export async function printLabOrdersForBooking(
  bookingId: string,
  opts?: {
    tests?: string[];
    diagnoses?: string[];
    clinicalNotes?: string;
    date?: string;
    catalog?: { name: string }[];
  },
): Promise<boolean> {
  const booking = await queryBookingById(supabase, bookingId);
  if (!booking) return false;

  const patientName = booking.patients
    ? `${booking.patients.first_name} ${booking.patients.last_name}`.trim()
    : "Patient";
  const doctorName = booking.doctors?.staff_accounts?.full_name ?? "";

  const [clinicRow, doctor, patient, labOrders, consult, catalog] = await Promise.all([
    queryClinicSettings(supabase),
    queryDoctorById(supabase, booking.doctor_id),
    queryPatientById(supabase, booking.patient_id),
    opts?.tests ? Promise.resolve([]) : queryLabOrdersByBooking(supabase, bookingId),
    queryConsultationByBooking(supabase, bookingId),
    opts?.catalog ? Promise.resolve([]) : queryLabTestCatalog(supabase),
  ]);

  const tests = opts?.tests ?? labOrders.map((l) => l.test_name.trim()).filter(Boolean);
  if (tests.length === 0) return false;

  let diagnoses = opts?.diagnoses;
  let clinicalNotes = opts?.clinicalNotes;
  if (consult?.consultation_id && (diagnoses === undefined || clinicalNotes === undefined)) {
    const diagRows = await queryDiagnoses(supabase, consult.consultation_id);
    if (diagnoses === undefined) diagnoses = diagnosisLabelsFromConsult(consult, diagRows);
    if (clinicalNotes === undefined) clinicalNotes = clinicalNotesFromConsult(consult);
  }

  return printLabRequest({
    clinic: clinicFromRow(clinicRow),
    doctor: doctorFromRow(doctor, doctorName),
    patient: patientFromRow(patient, patientName),
    tests,
    catalog: opts?.catalog ?? catalog.map((t) => ({ name: t.name })),
    date: opts?.date ?? booking.appointment_date,
    diagnoses,
    clinicalNotes,
  });
}
//JJQR - END
