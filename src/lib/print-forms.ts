/**
 * §16.7–16.8 — printable clinical documents (prescription, medical certificate,
 * lab request). Layout HTML lives in `print-forms-html.ts` (hard-coded
 * stationery letterhead). This module formats dates/age, then hands the
 * document body to `printHtml` with `{ brand: null, bare: true }` so the print
 * window does not add the default brand line or body padding.
 */
import { printHtml } from "@/lib/print";
import { takeReservedPrintWindow } from "@/lib/print-window"; //JJQR - AI (2026-11-25) - iPad: the window opened in the tap //JJQR - END
//JJQR - AI (Nov 24, 2026) - iPad: a real A5 PDF (iOS ignores a web page's paper size)
import { htmlToPdf, isIosDevice } from "@/lib/print-pdf";
//JJQR - END
import { todayManila } from "@/lib/clock";
//JJQR - AI (Nov 24, 2026) - the web prints like the desktop: the Admin's Printing settings are applied
import { getPrintPolicy, loadPrintPolicy, printBlockedMessage, withBackground, type PrintKind } from "@/lib/print-policy";
//JJQR - END
//JJQR - AI (Nov 20, 2026) E3
import { cleanMedCertAddress } from "@/lib/clinical/med-cert-fields";
//JJQR - END
import {
  buildLabRequestHtml,
  buildMedicalCertificateHtml,
  type DiagnosisLayout, //JJQR - AI (2026-11-27) - why: "Print as" choice //JJQR - END
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

//JJQR - AI (Nov 24, 2026) - owner: same as the desktop. A document the Admin switched off does not print; the clinic's background picture goes behind the form; the PTR number is left off (the desktop's "Include PTR in print" starts off).
function printForm(title: string, bodyHtml: string, kind: PrintKind): boolean {
  void loadPrintPolicy(); // keep the settings fresh for the next print
  const blocked = printBlockedMessage(kind, title);
  if (blocked) {
    if (typeof window !== "undefined") window.alert(blocked);
    return true; // handled: nothing to retry or "allow pop-ups" about
  }
  const html = withBackground(kind, bodyHtml);
  //JJQR - AI (Nov 24, 2026) - iPhone/iPad: open an A5 PDF (the window opens now, straight from the tap, and the PDF is placed in it); if anything fails the normal print runs in that window
  if (isIosDevice() && typeof window !== "undefined") {
    const win = takeReservedPrintWindow<Window>() ?? window.open("", "_blank"); //JJQR - AI (2026-11-25) - the window opened in the tap (lib/print-window.ts) //JJQR - END
    if (win) {
      win.document.write("<!doctype html><title>" + title + "</title><body style=\"font-family:-apple-system,sans-serif;padding:24px;color:#333\">Preparing the A5 print…</body>");
      void htmlToPdf(html, 148, 210).then(
        (blob) => { win.location.href = URL.createObjectURL(blob); },
        () => { win.close(); printHtml(title, html, { brand: null, bare: true }); },
      );
      return true;
    }
  }
  //JJQR - END
  return printHtml(title, html, { brand: null, bare: true });
}

function withoutPtr(d: PrintDoctor): PrintDoctor {
  return { ...d, ptr_number: null };
}
//JJQR - END

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
      doctor: withoutPtr(opts.doctor), //JJQR - AI (Nov 24, 2026) - PTR off, like the desktop default //JJQR - END
      patient: opts.patient,
      age: ageFromDob(opts.patient.date_of_birth),
      date: fmtDate(opts.date ?? new Date().toISOString()),
      items: opts.items,
      nextAppointment: opts.next_appointment ?? "",
    }),
    "prescription",
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
  diagnosisLayout?: DiagnosisLayout; //JJQR - AI (2026-11-27) - why: the "Print as" choice for this print (not stored) //JJQR - END
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
      doctor: withoutPtr(doctor),
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
      diagnosisLayout: opts.diagnosisLayout ?? "lines", //JJQR - AI (2026-11-27) - why: default = each diagnosis on its own line //JJQR - END
    }),
    "medical_certificate",
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
      doctor: withoutPtr(opts.doctor),
      patient: opts.patient,
      age: ageFromDob(opts.patient.date_of_birth),
      date: fmtDate(opts.date ?? new Date().toISOString()),
      items: getPrintPolicy().labTests ?? undefined, //JJQR - AI (Nov 24, 2026) - the tests the Admin chose (null = the clinic's printed list) //JJQR - END
      tests: opts.tests,
      diagnoses: opts.diagnoses,
      clinicalNotes: opts.clinicalNotes,
    }),
    "lab_request",
  );
}
