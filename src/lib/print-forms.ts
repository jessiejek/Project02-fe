/**
 * §16.7–16.8 — printable clinical documents (prescription, medical certificate,
 * lab request). Layout HTML lives in `print-forms-html.ts` (hard-coded
 * stationery letterhead). This module formats dates/age, then hands the
 * document body to `printHtml` with `{ brand: null, bare: true }` so the print
 * window does not add the default brand line or body padding.
 */
import { printHtml } from "@/lib/print";
import { todayManila } from "@/lib/clock";
//JJQR - AI (Nov 20, 2026) E3
import { cleanMedCertAddress } from "@/lib/clinical/med-cert-fields";
//JJQR - END
import {
  buildLabRequestHtml,
  buildMedicalCertificateHtml,
  buildPrescriptionHtml,
} from "@/lib/print-forms-html";

export interface PrintClinic {
  clinic_name: string;
  address: string;
  contact_number: string | null;
}

export interface PrintDoctor {
  full_name: string;
  license_number: string | null;
  ptr_number: string | null;
  s2_number?: string | null;
}

export interface PrintPatient {
  full_name: string;
  patient_code?: string;
  date_of_birth?: string | null;
  sex?: string | null;
  address?: string | null;
}

const PAGE_A5 = "148mm 210mm";

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "";

//JJQR - AI (Oct 31, 2026)
function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return "";
  const [ty, tm, td] = todayManila().split("-").map(Number);
  const [by, bm, bd] = dob.split("-").map(Number);
  if (!by) return "";
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 ? String(age) : "";
}
//JJQR - END

function assetOrigin(): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return "";
}

function printForm(title: string, bodyHtml: string): boolean {
  return printHtml(title, bodyHtml, { brand: null, bare: true });
}

export interface RxLine {
  generic_name: string;
  dosage: string;
  quantity: string;
  instruction?: string | null;
  timing?: string | null;
  meal_relation?: string | null;
  //JJQR - AI (Nov 20, 2026)
  as_needed?: boolean | null;
  //JJQR - END
  duration_kind?: string | null;
  duration_value?: number | null;
  indication?: string | null;
  is_controlled_substance?: boolean;
  //JJQR - AI (Oct 31, 2026)
  route?: string | null;
  //JJQR - END
}

export function printPrescription(opts: {
  clinic: PrintClinic;
  doctor: PrintDoctor;
  patient: PrintPatient;
  items: RxLine[];
  date?: string;
  next_appointment?: string | null;
}): boolean {
  return printForm(
    "Prescription",
    buildPrescriptionHtml({
      origin: assetOrigin(),
      pageSize: PAGE_A5,
      doctor: opts.doctor,
      patient: opts.patient,
      age: ageFromDob(opts.patient.date_of_birth),
      date: fmtDate(opts.date ?? new Date().toISOString()),
      items: opts.items,
      nextAppointment: opts.next_appointment ?? "",
    }),
  );
}

export interface MedCertData {
  issue_date?: string | null;
  patient_address_snapshot?: string | null;
  examined_at?: string | null;
  examination_date_from?: string | null;
  examination_date_to?: string | null;
  diagnosis_text?: string | null;
  recommendations?: string | null;
  purpose_exception?: string | null;
  come_back_on?: string | null;
}

export function printMedicalCertificate(opts: {
  clinic: PrintClinic;
  doctor: PrintDoctor;
  patient: PrintPatient;
  cert: MedCertData;
}): boolean {
  const { clinic, doctor, patient, cert } = opts;
  //JJQR - AI (Nov 20, 2026) E3 — print "residing at <address>" without doubling / dangling commas
  const addr = cleanMedCertAddress(cert.patient_address_snapshot ?? patient.address ?? "");
  //JJQR - END
  return printForm(
    "Medical Certificate",
    buildMedicalCertificateHtml({
      origin: assetOrigin(),
      pageSize: PAGE_A5,
      doctor,
      patient,
      issueDate: fmtDate(cert.issue_date ?? new Date().toISOString()),
      address: addr,
      examinedAt: cert.examined_at ?? clinic.clinic_name,
      examFrom: fmtDate(cert.examination_date_from),
      examTo: fmtDate(cert.examination_date_to),
      diagnosis: cert.diagnosis_text ?? "",
      recommendations: cert.recommendations ?? "",
      purposeException: cert.purpose_exception ?? "",
      comeBackOn: fmtDate(cert.come_back_on),
    }),
  );
}

export function printLabRequest(opts: {
  clinic: PrintClinic;
  doctor: PrintDoctor;
  patient: PrintPatient;
  tests: string[];
  catalog?: { name: string }[];
  date?: string;
  //JJQR - AI (Oct 31, 2026)
  clinicalNotes?: string | null;
  diagnoses?: string[];
  //JJQR - END
}): boolean {
  return printForm(
    "Laboratory Request",
    buildLabRequestHtml({
      origin: assetOrigin(),
      pageSize: PAGE_A5, //JJQR - AI (Nov 24, 2026) - the lab request is the same A5 sheet as the prescription and the medical certificate //JJQR - END
      doctor: opts.doctor,
      patient: opts.patient,
      age: ageFromDob(opts.patient.date_of_birth),
      date: fmtDate(opts.date ?? new Date().toISOString()),
      tests: opts.tests,
      diagnoses: opts.diagnoses,
      clinicalNotes: opts.clinicalNotes,
    }),
  );
}
