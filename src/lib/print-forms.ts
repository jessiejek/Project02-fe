/**
 * §16.7–16.8 — printable clinical documents (prescription, medical certificate,
 * lab request). One shared letterhead + signature block fed from live
 * `clinic_settings` + `doctors` data, then a form-specific body. All three call
 * `printHtml` with `brand: null` so the default brand line is suppressed and the
 * letterhead below is used instead.
 */
import { printHtml, escapeHtml } from "@/lib/print";

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

const e = (v: string | null | undefined) => escapeHtml(v ?? "");
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "";

function letterhead(clinic: PrintClinic): string {
  return `<div class="lh">
    <div class="lh-name">${e(clinic.clinic_name)}</div>
    <div class="lh-sub">${e(clinic.address)}${clinic.contact_number ? ` · ${e(clinic.contact_number)}` : ""}</div>
  </div>`;
}

function signature(doctor: PrintDoctor): string {
  const lines = [
    `<div class="sig-name">${e(doctor.full_name)}, MD</div>`,
    doctor.license_number ? `<div class="sig-line">License No. ${e(doctor.license_number)}</div>` : "",
    doctor.ptr_number ? `<div class="sig-line">PTR No. ${e(doctor.ptr_number)}</div>` : "",
  ];
  return `<div class="sig">${lines.join("")}</div>`;
}

const FORM_CSS = `
  .lh { text-align: center; border-bottom: 2px solid #0b1c30; padding-bottom: 10px; margin-bottom: 18px; }
  .lh-name { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; }
  .lh-sub { font-size: 11px; color: #3d4947; margin-top: 2px; }
  .doc-title { text-align: center; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 8px 0 18px; }
  .row { margin: 6px 0; }
  .row .lbl { color: #3d4947; }
  .rx-symbol { font-size: 32px; font-weight: 700; margin: 8px 0 4px; }
  .rx-item { margin: 10px 0; padding-left: 8px; }
  .rx-item .name { font-weight: 600; }
  .rx-item .sub { color: #3d4947; font-size: 12px; }
  .fill { border-bottom: 1px solid #6d7a77; display: inline-block; min-width: 60px; }
  .sig { margin-top: 56px; text-align: right; }
  .sig-name { font-weight: 700; border-top: 1px solid #0b1c30; display: inline-block; padding-top: 4px; }
  .sig-line { font-size: 11px; color: #3d4947; }
  .checklist { columns: 2; margin: 8px 0; }
  .checklist div { break-inside: avoid; margin: 3px 0; }
  .boiler { font-size: 11px; color: #3d4947; margin-top: 16px; font-style: italic; }
`;

function wrap(title: string, clinic: PrintClinic, doctor: PrintDoctor, inner: string): boolean {
  return printHtml(
    title,
    `<style>${FORM_CSS}</style>${letterhead(clinic)}${inner}${signature(doctor)}`,
    { brand: null },
  );
}

export interface RxLine {
  generic_name: string;
  dosage: string;
  quantity: string;
  instruction?: string | null;
  timing?: string | null;
  meal_relation?: string | null;
  duration_kind?: string | null;
  duration_value?: number | null;
  indication?: string | null;
  is_controlled_substance?: boolean;
}

export function printPrescription(opts: {
  clinic: PrintClinic;
  doctor: PrintDoctor;
  patient: PrintPatient;
  items: RxLine[];
  date?: string;
}): boolean {
  const { clinic, doctor, patient, items } = opts;
  const dateStr = fmtDate(opts.date ?? new Date().toISOString());
  const slotList = (t: string | null | undefined) => {
    const slots = (t ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (slots.length === 0) return "";
    if (slots.length === 1) return slots[0];
    return `${slots.slice(0, -1).join(", ")} & ${slots[slots.length - 1]}`;
  };
  const whenPhrase = (meal: string | null | undefined, t: string | null | undefined) => {
    const slots = slotList(t);
    const m = meal ? String(meal).toLowerCase() : "";
    if (m && slots) return `${m} ${slots}`;
    if (m) return `${m} meals`;
    if (slots) return `at ${slots}`;
    return "";
  };
  const durationPhrase = (kind: string | null | undefined, value: number | null | undefined) => {
    if (kind === "Maintain") return "maintenance";
    if ((kind === "Days" || kind === "Weeks") && value) {
      const unit = kind === "Days" ? "day" : "week";
      return `for ${value} ${unit}${value === 1 ? "" : "s"}`;
    }
    return "";
  };
  const rows = items
    .map((i, idx) => {
      const dir = [
        whenPhrase(i.meal_relation, i.timing),
        durationPhrase(i.duration_kind, i.duration_value),
      ].filter(Boolean).join(", ");
      const sigLine = dir ? dir.charAt(0).toUpperCase() + dir.slice(1) + "." : "";
      return `<div class="rx-item">
        <div class="name">${idx + 1}. ${e(i.generic_name)}${i.dosage ? ` ${e(i.dosage)}` : ""}${i.is_controlled_substance ? " (controlled)" : ""}</div>
        <div class="sub">Dispense #${e(i.quantity)}</div>
        ${sigLine ? `<div class="sub">Sig: ${e(sigLine)}</div>` : ""}
        ${i.indication ? `<div class="sub">For ${e(i.indication)}</div>` : ""}
        ${i.instruction ? `<div class="sub">${e(i.instruction)}</div>` : ""}
      </div>`;
    })
    .join("");
  const inner = `<div class="doc-title">Prescription</div>
    <div class="row"><span class="lbl">Patient:</span> <strong>${e(patient.full_name)}</strong>${patient.patient_code ? ` (${e(patient.patient_code)})` : ""}</div>
    <div class="row"><span class="lbl">Age/Sex:</span> ${e(patient.date_of_birth ? String(new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()) : "")} / ${e(patient.sex)}</div>
    <div class="row"><span class="lbl">Date:</span> ${e(dateStr)}</div>
    <div class="rx-symbol">℞</div>
    ${rows || '<div class="rx-item sub">No medicines prescribed.</div>'}`;
  return wrap("Prescription", clinic, doctor, inner);
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
  const addr = cert.patient_address_snapshot ?? patient.address ?? "";
  const inner = `<div class="doc-title">Medical Certificate</div>
    <div class="row">${e(fmtDate(cert.issue_date ?? new Date().toISOString()))}</div>
    <p class="row">This is to certify that <strong>${e(patient.full_name)}</strong>,
      residing at <span class="fill">${e(addr)}</span>,
      has been examined in <span class="fill">${e(cert.examined_at ?? clinic.clinic_name)}</span>
      on <span class="fill">${e(fmtDate(cert.examination_date_from))}</span>
      until <span class="fill">${e(fmtDate(cert.examination_date_to))}</span>.</p>
    <div class="row"><span class="lbl">Diagnosis / Impressions:</span><br/>${e(cert.diagnosis_text)}</div>
    <div class="row"><span class="lbl">Recommendations:</span><br/>${e(cert.recommendations)}</div>
    <p class="boiler">This certificate is issued upon request for whatever purpose it may serve${
      cert.purpose_exception ? ` except ${e(cert.purpose_exception)}` : " except ______"
    } and may not be used for medico-legal purposes.</p>
    ${cert.come_back_on ? `<div class="row"><span class="lbl">Please come back on:</span> ${e(fmtDate(cert.come_back_on))}</div>` : ""}`;
  return wrap("Medical Certificate", clinic, doctor, inner);
}

export function printLabRequest(opts: {
  clinic: PrintClinic;
  doctor: PrintDoctor;
  patient: PrintPatient;
  tests: string[];
  catalog?: { name: string }[];
  date?: string;
}): boolean {
  const { clinic, doctor, patient, tests } = opts;
  const chosen = new Set(tests.map((t) => t.toUpperCase()));
  const boxes = (opts.catalog ?? []).map(
    (t) => `<div>${chosen.has(t.name.toUpperCase()) ? "☑" : "☐"} ${e(t.name)}</div>`,
  );
  const extras = tests.filter((t) => !(opts.catalog ?? []).some((c) => c.name.toUpperCase() === t.toUpperCase()));
  const inner = `<div class="doc-title">Laboratory Request</div>
    <div class="row"><span class="lbl">Patient:</span> <strong>${e(patient.full_name)}</strong>${patient.patient_code ? ` (${e(patient.patient_code)})` : ""}</div>
    <div class="row"><span class="lbl">Date:</span> ${e(fmtDate(opts.date ?? new Date().toISOString()))}</div>
    <div class="checklist">${boxes.join("") || '<div class="sub">No standard panel loaded.</div>'}</div>
    ${extras.length ? `<div class="row"><span class="lbl">Additional:</span> ${e(extras.join(", "))}</div>` : ""}`;
  return wrap("Laboratory Request", clinic, doctor, inner);
}
