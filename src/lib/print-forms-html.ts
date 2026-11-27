/**
 * Printable clinic-form HTML builders (medical certificate, prescription, lab
 * request). Loaded by unit tests via Node's type stripping — keep this file
 * free of TypeScript-only syntax (enums, parameter properties).
 *
 * Letterhead is pre-printed stationery (LETTERHEAD) and is not taken from
 * clinic settings. Callers pass already-formatted dates/age; this module only
 * escapes and lays out.
 */

//JJQR - AI (Nov 20, 2026)
import { parseRxSig, rxDisplayName } from "./rx-sig-parse.ts";
import { timingToSlots } from "./rx-structured.ts";
//JJQR - END

interface HtmlDoctor {
  full_name: string;
  license_number: string | null;
  ptr_number: string | null;
  s2_number?: string | null;
}

interface HtmlPatient {
  full_name: string;
  patient_code?: string;
  date_of_birth?: string | null;
  sex?: string | null;
  address?: string | null;
}

interface HtmlRxLine {
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
  route?: string | null;
}

export interface McHtmlOpts {
  origin: string;
  pageSize: string;
  doctor: HtmlDoctor;
  patient: HtmlPatient;
  issueDate: string;
  address: string;
  examinedAt: string;
  examFrom: string;
  examTo: string;
  diagnosis: string;
  recommendations: string;
  purposeException: string;
  comeBackOn: string;
}

export interface RxHtmlOpts {
  origin: string;
  pageSize: string;
  doctor: HtmlDoctor;
  patient: HtmlPatient;
  age: string;
  date: string;
  items: HtmlRxLine[];
  nextAppointment?: string | null;
}

export interface LabHtmlOpts {
  origin: string;
  pageSize: string;
  doctor: HtmlDoctor;
  patient: HtmlPatient;
  age: string;
  date: string;
  tests: string[];
  diagnoses?: string[];
  clinicalNotes?: string | null;
  //JJQR - AI (Nov 24, 2026) - owner: the Admin can add and remove the tests on the lab request. Omitted or empty = the clinic's printed pad list (LAB_DEFAULT_ITEMS).
  items?: string[];
  //JJQR - END
}

const LETTERHEAD = {
  name: "ALLYN GRACE T. ESPAÑA-GAVINO, MD",
  line2: "FAMILY AND COMMUNITY MEDICINE",
  line3: "ADULT AND PEDIA",
  clinic: "GRACE MEDICAL CLINIC",
  street: "3ML Quezon National Highway",
  city: "Buaya, Lapu Lapu City",
  contact: "Contact # 09285612976",
  weekdayDay: "Monday to Friday",
  weekdayHours: "10:00am - 5:00pm",
  evening: "7:00pm - 8:00pm",
  saturday: "Saturday",
  saturdayHours: "10:00pm- 5:00pm",
};

//JJQR - AI (Nov 24, 2026) - owner: the clinic's lab does these tests (the pad's printed list plus the hand-written TSH, FT3, FT4, HbA1c). This is the DEFAULT; the Admin can add and remove tests.
export const LAB_DEFAULT_ITEMS = [
  "CBC", "URINALYSIS", "LIPID PROFILE", "SGPT", "CREA", "FBS", "BUA",
  "TSH", "FT3", "FT4", "HbA1c", "DENGUE NS1, IgG, IgM", "ECG 12L",
];
export const LAB_MAX_ITEMS = 26;

/** The tests to print: the Admin's list (trimmed, no blanks or repeats, at most LAB_MAX_ITEMS) or the default. */
export function normalizeLabItems(items: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen: { [k: string]: boolean } = {};
  for (const raw of items ?? []) {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    const k = t.toLowerCase();
    if (!t || seen[k]) continue;
    seen[k] = true;
    out.push(t);
    if (out.length >= LAB_MAX_ITEMS) break;
  }
  return out.length ? out : LAB_DEFAULT_ITEMS.slice();
}

function labTop(hundredths: number): string {
  return Math.floor(hundredths / 100) + "." + String(hundredths % 100).padStart(2, "0") + "in";
}
//JJQR - END

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function e(v: string | null | undefined): string {
  return escapeHtml(v ?? "");
}

function asset(origin: string, file: string): string {
  return e(origin) + "/forms/" + file;
}

function flat(v: string | null | undefined): string {
  return e((v ?? "").replace(/\s+/g, " ").trim());
}

function rxMcSigName(doctor: HtmlDoctor): string {
  const n = (doctor.full_name || "").trim();
  if (!n) return LETTERHEAD.name;
  const u = n.toUpperCase();
  return /,\s*MD$/.test(u) ? u : u + ", MD";
}

function labSigName(doctor: HtmlDoctor): string {
  const n = (doctor.full_name || "").trim();
  if (!n) return LETTERHEAD.name.replace(/, MD$/, "");
  return n.replace(/,?\s*MD\s*$/i, "").trim();
}

function labSigFontSize(name: string): string {
  const availIn = 1.48;
  const est = name.length * 0.5 * (6 / 72);
  if (est <= availIn) return "6pt";
  const pt = 6 * (availIn / est);
  return (pt < 4.2 ? 4.2 : Math.round(pt * 100) / 100) + "pt";
}

function letterheadHtml(origin: string): string {
  return (
    '<div class="lh">' +
      '<img class="lh-logo" src="' + asset(origin, "logo.png") + '" alt="" />' +
      '<div class="lh-doc">' + LETTERHEAD.name + "</div>" +
      '<div class="lh-spec lh-fam">' + LETTERHEAD.line2 + "</div>" +
      '<div class="lh-spec lh-adult">' + LETTERHEAD.line3 + "</div>" +
      '<img class="lh-seal" src="' + asset(origin, "seal.png") + '" alt="" />' +
      '<div class="lh-c1">' + LETTERHEAD.clinic + "</div>" +
      '<div class="lh-c2">' + LETTERHEAD.street + "</div>" +
      '<div class="lh-c3">' + LETTERHEAD.city + "</div>" +
      '<div class="lh-c4">' + LETTERHEAD.contact + "</div>" +
      '<div class="lh-r1d"><span class="h-day">' + LETTERHEAD.weekdayDay + " " + LETTERHEAD.weekdayHours + "</span></div>" +
      '<div class="lh-r2t"><span class="h-time">' + LETTERHEAD.evening + "</span></div>" +
      '<div class="lh-r3d"><span class="h-day">' + LETTERHEAD.saturday + "</span></div>" +
      '<div class="lh-r3t"><span class="h-time">' + LETTERHEAD.saturdayHours + "</span></div>" +
    "</div>"
  );
}

function credLine(label: string, value: string): string {
  return (
    '<div class="sig-row"><span class="sig-lbl">' +
    label +
    '</span><span class="u sig-u">' +
    e(value) +
    "</span></div>"
  );
}

function signatureBlock(doctor: HtmlDoctor): string {
  const lines = [
    '<div class="sig-name">' + e(rxMcSigName(doctor)) + "</div>",
    credLine("License No:", doctor.license_number ?? ""), //JJQR - AI (Nov 24, 2026) - owner: what the doctor fills in under Profile prints on the prescription, medical certificate and lab request; the line stays blank when it is empty //JJQR - END
    credLine("PTR No:", doctor.ptr_number ?? ""),
  ];
  if (doctor.s2_number) lines.push(credLine("S2 No:", doctor.s2_number));
  return '<div class="sig">' + lines.join("") + "</div>";
}

function shellCss(pageSize: string, width: string, height: string): string {
  return `
@page { size: ${pageSize}; margin: 0; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
}
body {
  background: #9a9a9a !important;
  min-height: 100vh;
  display: block !important;
  padding: 18px !important;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  color-adjust: exact;
}
.form {
  width: ${width};
  height: ${height};
  position: relative;
  overflow: hidden;
  background: #fff;
  box-sizing: border-box;
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
  font-family: Arial, Helvetica, sans-serif;
  color: #222;
  margin: 0 auto;
  padding: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  color-adjust: exact;
}
.form-tall {
  height: auto !important;
  min-height: ${height};
  overflow: visible !important;
}
.lh {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  color: #333;
}
.lh > * {
  position: absolute;
  white-space: nowrap;
}
.lh-doc {
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  color: #2f5f9e;
}
.lh-spec { color: #222; font-weight: 500; }
.h-day { white-space: nowrap; }
.h-time { text-align: right; white-space: nowrap; }
.rule-double {
  border-top: 3px solid #4a7bb7;
  padding-top: 2px;
  border-bottom: 1px solid #4a7bb7;
  box-sizing: content-box;
}
.rule-single { border-top: 1px solid #333; }
.u {
  display: inline-block;
  border-bottom: 1px solid #333;
  min-width: 0.4in;
  line-height: 1.15;
  padding: 0 1px;
  vertical-align: baseline;
}
.ln {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
}
.ln .grow { flex: 1; min-width: 0; }
.sig-name {
  font-weight: 700;
  color: #3d5a80;
  white-space: nowrap;
}
.sig-row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.sig-u { flex: 1; min-width: 0.7in; }
img { display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  html, body {
    background: #fff !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: 0 !important;
    display: block !important;
    width: auto;
    height: auto;
  }
  .form {
    box-shadow: none !important;
    margin: 0 auto !important;
  }
  .form:not(.form-tall) {
    overflow: hidden;
    page-break-after: avoid;
    break-after: avoid;
  }
  .rx-row { break-inside: avoid; page-break-inside: avoid; }
}
`;
}

function a5LetterheadCss(ruleTop: string): string {
  return `
.lh { height: ${ruleTop}; }
.lh-logo {
  left: 0.32in;
  top: 0.40in;
  width: 0.40in;
  height: auto;
}
.lh-seal {
  left: 4.78in;
  top: 0.45in;
  width: 0.52in;
  height: auto;
}
.lh-doc {
  left: 2.83in;
  top: 0.49in;
  transform: translate(-50%, -50%);
  font-size: 12.5pt;
  line-height: 0.21in;
}
.lh-fam {
  left: 2.83in;
  top: 0.70in;
  transform: translate(-50%, -50%);
  font-size: 9.4pt;
  line-height: 0.14in;
}
.lh-adult {
  left: 2.83in;
  top: 0.84in;
  transform: translate(-50%, -50%);
  font-size: 9.4pt;
  line-height: 0.14in;
}
.lh-c1, .lh-c2, .lh-c3, .lh-c4 {
  left: 0.96in;
  font-size: 7.6pt;
  line-height: 0.14in;
  transform: translateY(-50%);
}
.lh-c1 { top: 1.10in; }
.lh-c2 { top: 1.24in; }
.lh-c3 { top: 1.38in; }
.lh-c4 { top: 1.52in; }
.lh-r1d, .lh-r3d {
  left: 3.09in;
  font-size: 7.6pt;
  transform: translateY(-50%);
}
.lh-r1d { top: 1.10in; line-height: 0.16in; }
.lh-r3d { top: 1.40in; line-height: 0.14in; }
.lh-r1t, .lh-r2t, .lh-r3t {
  left: 4.77in;
  font-size: 7.6pt;
  transform: translate(-100%, -50%);
}
.lh-r1t { top: 1.10in; line-height: 0.16in; }
.lh-r2t { top: 1.26in; line-height: 0.16in; }
.lh-r3t { top: 1.40in; line-height: 0.14in; }
.rule-double {
  position: absolute;
  top: ${ruleTop};
  left: 0.32in;
  width: 5.05in;
}
`;
}

function titleOpts(sex: string | null | undefined): string {
  const s = (sex ?? "").toLowerCase();
  function opt(label: string, hit: boolean): string {
    return '<span class="t-opt' + (hit ? " t-hit" : "") + '">' + label + "</span>";
  }
  return (
    opt("Mr.", s === "male") +
    '<span class="t-sep">/</span>' +
    opt("Ms.", s === "female") +
    '<span class="t-sep">/</span>' +
    opt("Mrs.", false)
  );
}

export function buildMedicalCertificateHtml(opts: McHtmlOpts): string {
  const exceptionText = opts.purposeException.trim();
  const purposeBlock = exceptionText
    ? '<div class="mc-purpose"><div class="write-lines"><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>' +
      '<div class="write-text">' +
      e(exceptionText) +
      "</div></div>"
    : "";
  const css =
    shellCss(opts.pageSize, "148mm", "210mm") +
    a5LetterheadCss("1.62in") +
    `
.form-mc {
  width: 148mm;
  height: 210mm;
  --pad-l: 0.50in;
  --pad-r: 0.53in;
}
.mc-title {
  position: absolute;
  top: 1.90in;
  left: 0;
  right: 0;
  text-align: center;
  font-weight: 700;
  font-size: 14pt;
  color: #4a4f55;
  letter-spacing: normal;
}
.mc-date {
  position: absolute;
  top: 2.34in;
  right: var(--pad-r);
  font-size: 9pt;
  color: #222;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  white-space: nowrap;
}
.mc-date .u {
  width: 1.45in;
  min-width: 1.45in;
  white-space: nowrap;
}
.mc-to {
  position: absolute;
  top: 2.71in;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
}
.mc-certify {
  position: absolute;
  top: 2.94in;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
}
.mc-certify > span:first-child { white-space: nowrap; }
.t-opt {
  display: inline-block;
}
.t-sep { display: inline-block; }
.t-hit {
  border: 1px solid #222;
  border-radius: 999px;
  padding: 0 3px;
  margin: 0 -3px;
  box-sizing: border-box;
}
.mc-residing {
  position: absolute;
  top: 3.19in;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
}
.mc-exam {
  position: absolute;
  top: 3.42in;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
}
.mc-on {
  position: absolute;
  top: 3.66in;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
}
.mc-on .on-u { width: 55%; min-width: 1.4in; flex: 0 0 55%; }
.write {
  position: absolute;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
  color: #222;
}
.write-lines .wl {
  border-bottom: 1px solid #333;
  height: 0.23in;
  box-sizing: border-box;
}
.write-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  line-height: 0.23in;
  height: 0.69in;
  overflow: hidden;
  font-size: 9pt;
  z-index: 1;
}
.write-lbl {
  font-size: 9pt;
  display: inline-block;
  height: 0.23in;
  line-height: 0.23in;
  background: #fff;
  padding-right: 0.08in;
  white-space: nowrap;
  vertical-align: top;
  position: relative;
  z-index: 1;
}
.mc-diag { top: 4.17in; }
.mc-rec { top: 5.10in; }
.mc-disc {
  position: absolute;
  top: 5.90in;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 9pt;
}
.mc-boiler {
  font-size: 9pt;
  line-height: 1.15;
  height: 0.25in;
  white-space: nowrap;
}
.mc-purpose {
  position: relative;
  max-height: 0.69in;
  overflow: hidden;
  font-size: 9pt;
  line-height: 0.23in;
}
.mc-purpose .write-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.mc-purpose .write-text {
  position: relative;
  height: auto;
  max-height: 0.69in;
  overflow: hidden;
  line-height: 0.23in;
  font-size: 9pt;
}
.mc-boiler2 {
  font-size: 9pt;
}
.mc-back {
  position: absolute;
  top: 7.27in;
  left: var(--pad-l);
  width: 1.9in;
  font-size: 9pt;
}
.mc-back .back-u {
  display: block;
  width: 1.7in;
  min-width: 1.7in;
  margin-top: 0.18in;
}
.mc-sig {
  position: absolute;
  top: 7.47in;
  left: 2.76in;
  right: var(--pad-r);
}
.form-mc .sig-name { font-size: 7.5pt; font-weight: 700; height: 0.20in; line-height: 0.20in; }
.form-mc .sig-row { font-size: 7.5pt; height: 0.20in; margin: 0; line-height: 0.20in; }

.form-mc .ln { width: auto; }
/* JJQR - AI (2026-11-27) - why: the diagnosis block can get extra ruled lines (tighter spacing, still one page); defaults = the 3 printed lines */
.mc-diag .wl { height: var(--dx-lh, 0.23in); }
.mc-diag .write-text { line-height: var(--dx-lh, 0.23in); height: var(--dx-h, 0.69in); font-size: var(--dx-fs, 9pt); }
.mc-diag .write-lbl { height: var(--dx-lh, 0.23in); line-height: var(--dx-lh, 0.23in); font-size: var(--dx-fs, 9pt); }
/* JJQR - END */`; //JJQR - AI (Nov 23, 2026) - every pinned line used width:100% inside the left/right margins, so its underline ran past the right margin to the page edge. Let it fill only the margin box (the desktop already did; keeps both prints identical) //JJQR - END

  const inner =
    letterheadHtml(opts.origin) +
    '<div class="rule-double"></div>' +
    '<div class="mc-title">MEDICAL CERTIFICATE</div>' +
    '<div class="mc-date">Date: <span class="u">' + e(opts.issueDate) + "</span></div>" +
    '<div class="mc-to">To whom it may concern,</div>' +
    '<div class="mc-certify ln"><span>This is to certify that ' +
    titleOpts(opts.patient.sex) +
    '</span><span class="u grow">' +
    e(opts.patient.full_name) +
    "</span></div>" +
    '<div class="mc-residing ln"><span>residing at</span><span class="u grow">' +
    e(opts.address) +
    "</span></div>" +
    '<div class="mc-exam ln"><span>has been examined in</span><span class="u grow">' +
    e(opts.examinedAt) +
    "</span></div>" +
    '<div class="mc-on ln"><span>on</span><span class="u on-u">' +
    e(opts.examFrom) +
    '</span><span>until</span><span class="u grow">' +
    e(opts.examTo) +
    "</span><span>.</span></div>" +
    diagnosisBlock(opts.diagnosis) + //JJQR - AI (2026-11-27) - why: one diagnosis per ruled line (was flat(opts.diagnosis), which ran "1) ...;2) ..." together) //JJQR - END
    '<div class="write mc-rec"><div class="write-lines"><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>' +
    '<div class="write-text">' +
    '<span class="write-lbl">Recommendations:</span>' +
    flat(opts.recommendations) +
    "</div></div>" +
    '<div class="mc-disc">' +
    '<div class="mc-boiler">This certificate is issued upon the request for whatever purpose it may serve except</div>' +
    purposeBlock +
    '<div class="mc-boiler2">and may not be used for medico-legal purposes.</div>' +
    "</div>" +
    '<div class="mc-back"><div>Please come back on:</div><span class="u back-u">' +
    e(opts.comeBackOn) +
    "</span></div>" +
    '<div class="mc-sig">' +
    signatureBlock(opts.doctor) +
    "</div>";

  return "<style>" + css + '</style><div class="form form-mc">' + inner + "</div>";
}

//JJQR - AI (Nov 20, 2026)
function slotSpan(label: string, kind: string): string {
  const cls = kind === "pill" ? "slot pill" : kind === "faint" ? "slot faint" : "slot";
  return '<span class="' + cls + '">' + label + "</span>";
}

function slotLine(slots: string[], asNeeded: boolean, asDirected: boolean): string {
  if ((asNeeded || asDirected) && slots.length === 0) {
    const note = asNeeded ? "as needed" : "as directed";
    return '<span class="slot-note">' + note + "</span>";
  }
  const chosen: { [k: string]: boolean } = {};
  for (let i = 0; i < slots.length; i++) chosen[slots[i]] = true;
  const mark = slots.length > 0;
  const labels = ["BREAKFAST", "LUNCH", "DINNER", "BEDTIME"];
  const parts: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (i) parts.push(" - ");
    const kind = mark ? (chosen[labels[i]] ? "pill" : "faint") : "plain";
    parts.push(slotSpan(labels[i], kind));
  }
  return parts.join("");
}

function mealLine(meal: string | null | undefined): string {
  const m = meal === "before" || meal === "after" ? meal : null;
  const beforeKind = m ? (m === "before" ? "pill" : "faint") : "plain";
  const afterKind = m ? (m === "after" ? "pill" : "faint") : "plain";
  return slotSpan("before/", beforeKind) + " " + slotSpan("after", afterKind);
}
//JJQR - END

function durFill(kind: string | null | undefined, want: string, value: number | null | undefined): string {
  if (kind === want && value !== null && value !== undefined) return e(String(value));
  return "";
}

function isWordChar(ch: string): boolean {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= 48 && c <= 57) ||
    (c >= 65 && c <= 90) ||
    (c >= 97 && c <= 122) ||
    c === 95
  );
}

function startsWithWord(text: string, word: string): boolean {
  if (!word || text.length < word.length) return false;
  if (text.slice(0, word.length).toLowerCase() !== word.toLowerCase()) return false;
  if (text.length === word.length) return true;
  return !isWordChar(text.charAt(word.length));
}

function collapseDupFirstWord(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const sp = t.indexOf(" ");
  if (sp < 0) return t;
  const first = t.slice(0, sp);
  const rest = t.slice(sp + 1);
  const sp2 = rest.indexOf(" ");
  const second = sp2 < 0 ? rest : rest.slice(0, sp2);
  if (first.toLowerCase() !== second.toLowerCase()) return t;
  return first + (sp2 < 0 ? "" : rest.slice(sp2));
}

//JJQR - AI (2026-11-25) - exported so the on-screen previews (lib/rx-preview.ts) use the printed form's own Sig rule; output unchanged
export function sigFreeText(item: Pick<HtmlRxLine, "route" | "instruction">): string {
//JJQR - END
  const route = (item.route ?? "").trim();
  const instruction = (item.instruction ?? "").trim();
  let text = "";
  if (!route) text = instruction;
  else if (!instruction) text = route;
  else if (startsWithWord(instruction, route)) text = instruction;
  else text = route + " " + instruction;
  return collapseDupFirstWord(text);
}

//JJQR - AI (Nov 20, 2026)
function savedMeal(mealRelation: string | null | undefined): "before" | "after" | null {
  const m = (mealRelation ?? "").trim().toLowerCase();
  if (m === "before" || m === "after") return m;
  return null;
}

function savedPrintSlots(timing: string | null | undefined): string[] {
  const labels = timingToSlots(timing);
  const out: string[] = [];
  for (let i = 0; i < labels.length; i++) out.push(labels[i].toUpperCase());
  return out;
}

function hasSavedStructured(item: HtmlRxLine): boolean {
  const meal = (item.meal_relation ?? "").trim();
  const timing = (item.timing ?? "").trim();
  return meal.length > 0 || timing.length > 0 || typeof item.as_needed === "boolean";
}

function rxRow(item: HtmlRxLine): string {
  let meal: "before" | "after" | null;
  let slots: string[];
  let asNeeded: boolean;
  let asDirected: boolean;
  if (hasSavedStructured(item)) {
    meal = savedMeal(item.meal_relation);
    slots = savedPrintSlots(item.timing);
    asNeeded = item.as_needed === true;
    asDirected = false;
  } else {
    const parsed = parseRxSig({
      instruction: item.instruction,
      route: item.route,
      timing: item.timing,
      mealRelation: item.meal_relation,
    });
    meal = parsed.meal;
    slots = parsed.slots;
    asNeeded = parsed.asNeeded;
    asDirected = parsed.asDirected;
  }
  const name = rxDisplayName(item.generic_name, item.dosage);
  const qty = item.quantity;
  const sig = sigFreeText(item);
  const sigClass = "sig-free" + (sig.length > 70 ? " sig-long" : "");
  const indication = item.indication ?? "";
  const kind = item.duration_kind;
  const val = item.duration_value;
  const maintain = kind === "Maintain" ? "✓" : "";
  return (
    '<tr class="rx-row">' +
      '<td class="rx-med">' +
        '<div class="rx-med-top">' +
          '<div class="rx-med-name">' + e(name) + "</div>" +
          '<div class="rx-qty"># <span class="u">' + e(qty) + "</span></div>" +
        "</div>" +
        '<div class="rx-sig">' +
          '<span class="sig-k">Sig.</span>' +
          '<span class="' + sigClass + '">' + e(sig) + "</span>" +
          '<span class="meal">' + mealLine(meal) + "</span>" +
        "</div>" +
        '<div class="rx-slots">' + slotLine(slots, asNeeded, asDirected) + "</div>" +
      "</td>" +
      '<td class="rx-dur">' +
        '<div class="dur-m"><span class="cb">' + maintain + "</span> Maintain</div>" +
        '<div><span class="u dur-u">' + durFill(kind, "Days", val) + "</span> Days</div>" +
        '<div><span class="u dur-u">' + durFill(kind, "Weeks", val) + "</span> Weeks</div>" +
      "</td>" +
      '<td class="rx-ind">' + e(indication) + "</td>" +
    "</tr>"
  );
}
//JJQR - END

//JJQR - AI (2026-11-26) - GAV-14: a height guess (hundredths of an inch) for each printed row, from Arial's letter widths and the same word wrapping the printer does, so the bigger print never runs into the signature / Next appointment. Mirrored exactly in the desktop's ClinicFormsHtml (golden tests compare the HTML).
const RX_ROWS_SPACE = 464; // 2.86in (under the table header) down to 7.50in (just above the signature block at 7.54in)
const RX_ONE_PAGE_MAX = 6;
const RX_ROOMY_MAX = 3;
const RX_AIRY_MAX = 4;
const RX_AIRY_EXTRA = 25; // .rx-airy adds 0.25in of padding to each row
const RX_SPARE = 8; // spare, in case a printer wraps a line more than the guess

// Arial / Helvetica widths (1/1000 em) for the characters space (32) to ~ (126); [0] regular, [1] bold
const RX_AFM: number[][] = [[
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
], [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]];

// widths are 1/1000 em x font size in tenths of a pt = 1/10000 pt
function rxTextW(text: string, bold: boolean, size10: number): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    w += c >= 32 && c <= 126 ? RX_AFM[bold ? 1 : 0][c - 32] : 1000;
  }
  return w * size10;
}

function rxWrapLines(text: string, bold: boolean, size10: number, avail: number): number {
  const words = text.split(" ");
  const space = rxTextW(" ", bold, size10);
  let lines = 1;
  let cur = 0;
  let any = false;
  for (let i = 0; i < words.length; i++) {
    if (!words[i]) continue;
    const w = rxTextW(words[i], bold, size10);
    if (!any) {
      cur = w;
      any = true;
    } else if (cur + space + w <= avail) {
      cur += space + w;
    } else {
      lines++;
      cur = w;
    }
    while (cur > avail) {
      lines++;
      cur -= avail;
    }
  }
  return lines;
}

function rxRowHeight(item: HtmlRxLine, roomy: boolean): number {
  const name = rxDisplayName(item.generic_name, item.dosage);
  const qty = item.quantity ?? "";
  const sig = sigFreeText(item);
  const long = sig.length > 70;
  const nameSize = roomy ? 130 : 105;
  const sigSize = roomy ? (long ? 95 : 105) : (long ? 80 : 85);
  const labelSize = roomy ? 105 : 85;
  const mealSize = roomy ? 95 : 80;
  const indSize = roomy ? 95 : 85;
  const inner = roomy ? 1976000 : 1992000; // the medicine cell inside its padding (2.745in / 2.766in)
  const qtyU = rxTextW(qty, true, nameSize) + 15000;
  const nameAvail = inner - 45000 - rxTextW("# ", true, nameSize) - (qtyU > 288000 ? qtyU : 288000);
  const mealW = (rxTextW("before/", true, mealSize) + rxTextW(" ", false, mealSize) + rxTextW("after", true, mealSize)) + 52500;
  const sigAvail = inner - rxTextW("Sig.", true, labelSize) - 90000 - mealW;
  const indAvail = roomy ? 572000 : 587000;
  const nameLines = rxWrapLines(name, true, nameSize, nameAvail);
  const sigLines = rxWrapLines(sig, false, sigSize, sigAvail);
  const indLines = rxWrapLines(item.indication ?? "", false, indSize, indAvail);
  // line heights from the CSS; the fixed parts were fitted on 800 rendered rows per size
  const med = roomy ? 58 + nameLines * 21 + sigLines * 17 : 30 + nameLines * 17 + sigLines * 14;
  const ind = roomy ? 20 + indLines * 16 : 10 + indLines * 15;
  return med > ind ? med : ind;
}

export function rxLayout(items: HtmlRxLine[]): { roomy: boolean; airy: boolean; tall: boolean } {
  // biggest size that still fits one page: roomy (1-3 medicines) > airy (up to 4) > normal (up to 6); otherwise normal size flowing onto a 2nd page
  const fits = (roomy: boolean, extra: number): boolean => {
    let total = RX_SPARE;
    for (let i = 0; i < items.length; i++) total += rxRowHeight(items[i], roomy) + extra;
    return total <= RX_ROWS_SPACE;
  };
  if (items.length <= RX_ROOMY_MAX && fits(true, 0)) return { roomy: true, airy: false, tall: false };
  if (items.length <= RX_AIRY_MAX && fits(false, RX_AIRY_EXTRA)) return { roomy: false, airy: true, tall: false };
  if (items.length <= RX_ONE_PAGE_MAX && fits(false, 0)) return { roomy: false, airy: false, tall: false };
  return { roomy: false, airy: false, tall: true };
}
//JJQR - END

//JJQR - AI (2026-11-27) - why: Dr. Allyn wants each diagnosis on its own ruled line of the medical certificate ("mu newline igka 2"). Split at print time on new lines, ";" and before every number marker after the first ("2)" / "2."), then give each item its own line; more lines than the 3 printed ones get extra ruled lines with tighter spacing so the certificate stays one page. Mirrored exactly in the desktop's ClinicFormsHtml (golden tests compare the HTML).
const DX_MARKER = /(^|[ \t,])([0-9]{1,2})[.)](?=[ \t]*[A-Za-z])/g;
const DX_LINES = 3; // ruled lines printed on the pad
const DX_LH = 230; // their spacing, thousandths of an inch (0.23in)
const DX_SPACE = 910; // 4.17in (top of the block) down to 5.08in (just above Recommendations at 5.10in)
const DX_W = 3352320; // 4.80in writing width (A5 less the 0.50in / 0.53in margins) in 1/10000 pt, less 3% spare
const DX_SIZE = 90; // 9pt
const DX_LBL = 57600; // the label's 0.08in right padding, 1/10000 pt

export function splitDiagnosisLines(text: string | null | undefined): string[] {
  const out: string[] = [];
  const push = (s: string): void => {
    const t = s.replace(/\s+/g, " ").trim().replace(/[ ,]+$/, "");
    if (t) out.push(t);
  };
  const parts = (text ?? "").split(/\r\n|\r|\n|;/);
  for (let p = 0; p < parts.length; p++) {
    const part = parts[p];
    let from = 0;
    DX_MARKER.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DX_MARKER.exec(part)) !== null) {
      const at = m.index + m[1].length;
      if (part.slice(0, at).trim() === "") continue; // never before the first item
      push(part.slice(from, at));
      from = at;
    }
    push(part.slice(from));
  }
  return out;
}

function dxWrapLines(text: string, firstAvail: number, avail: number): number {
  const words = text.split(" ");
  const space = rxTextW(" ", false, DX_SIZE);
  let lines = 1;
  let room = firstAvail;
  let cur = 0;
  let any = false;
  for (let i = 0; i < words.length; i++) {
    if (!words[i]) continue;
    const w = rxTextW(words[i], false, DX_SIZE);
    if (!any) {
      cur = w;
      any = true;
    } else if (cur + space + w <= room) {
      cur += space + w;
    } else {
      lines++;
      room = avail;
      cur = w;
    }
    while (cur > room) {
      lines++;
      cur -= room;
      room = avail;
    }
  }
  return lines;
}

function dxInches(mils: number): string {
  const r = mils % 1000;
  return Math.floor(mils / 1000) + "." + (r < 10 ? "00" : r < 100 ? "0" : "") + r + "in";
}

function diagnosisBlock(text: string | null | undefined): string {
  const items = splitDiagnosisLines(text);
  let lines = 0;
  const first = DX_W - rxTextW("Diagnosis/ Impressions:", false, DX_SIZE) - DX_LBL;
  for (let i = 0; i < items.length; i++) lines += dxWrapLines(items[i], i === 0 ? first : DX_W, DX_W);
  const n = lines > DX_LINES ? lines : DX_LINES;
  let style = "";
  if (n > DX_LINES) {
    const fit = Math.floor(DX_SPACE / n);
    const lh = fit < DX_LH ? fit : DX_LH;
    const fs = lh >= 170 ? "9pt" : lh >= 140 ? "8pt" : lh >= 115 ? "7pt" : "6pt";
    style = ' style="--dx-lh:' + dxInches(lh) + ";--dx-h:" + dxInches(lh * n) + ";--dx-fs:" + fs + '"';
  }
  let rules = "";
  for (let i = 0; i < n; i++) rules += '<div class="wl"></div>';
  const body: string[] = [];
  for (let i = 0; i < items.length; i++) body.push(e(items[i]));
  return (
    '<div class="write mc-diag"' + style + '><div class="write-lines">' + rules + "</div>" +
    '<div class="write-text">' +
    '<span class="write-lbl">Diagnosis/ Impressions:</span>' +
    body.join("<br>") +
    "</div></div>"
  );
}
//JJQR - END

export function buildPrescriptionHtml(opts: RxHtmlOpts): string {
  //JJQR - AI (Nov 20, 2026)
  const rows: string[] = [];
  for (let i = 0; i < opts.items.length; i++) {
    rows.push(rxRow(opts.items[i]));
  }
  //JJQR - END
  //JJQR - AI (2026-11-26) - GAV-14 bigger print: 1-3 medicines get the roomy size, 4 get extra space, up to 6 stay on one page, anything that would run into the signature flows onto a 2nd page instead of shrinking
  const layout = rxLayout(opts.items);
  const tall = layout.tall;
  //JJQR - END
  const css =
    shellCss(opts.pageSize, "148mm", "210mm") +
    a5LetterheadCss("1.58in") +
    `
.form-rx {
  width: 148mm;
  height: 210mm;
  --pad-l: 0.35in;
  --pad-r: 0.65in;
}
.rx-name, .rx-addr, .rx-age, .rx-sex, .rx-date {
  position: absolute;
  font-size: 7.5pt;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.rx-name {
  top: 1.77in;
  left: var(--pad-l);
  right: 35%;
}
.rx-age {
  top: 1.77in;
  left: 66%;
  right: 24%;
}
.rx-sex {
  top: 1.77in;
  left: 77%;
  right: var(--pad-r);
}
.rx-addr {
  top: 1.98in;
  left: var(--pad-l);
  right: 35%;
}
.rx-date {
  top: 1.98in;
  left: 66%;
  right: var(--pad-r);
  white-space: nowrap;
}
.rx-name .u, .rx-addr .u, .rx-date .u { flex: 1; min-width: 0; }
.rx-age .u { width: 0.42in; min-width: 0.42in; }
.rx-sex .u { flex: 1; min-width: 0.4in; }
.rx-img {
  position: absolute;
  left: var(--pad-l);
  top: 2.25in;
  width: 0.6in;
  height: auto;
}
/* JJQR - AI (2026-11-26) - GAV-14 doctor: "make our prescription BIG / more readable" + "SPACE" between medicines + "BIGGER" Duration number. Same A5 pad: header, patient lines, Rx, signature and Next appointment stay put; the table starts beside the Rx (its header row has no medicine text) and uses the empty half of the page. Base sizes are for 5-6 medicines; .rx-airy (4 medicines) adds space between rows; .rx-roomy (1-3 medicines) is bigger still. Old sizes: name 8.5pt, # 8pt, Sig 7pt, slots 7pt, Days number 6pt. Also fixes 6+ medicines printing on top of the letterhead (flow-root at the end). */
.rx-tbl {
  position: absolute;
  left: 0.43in;
  top: 2.58in;
  border-collapse: collapse;
  width: 4.75in;
  table-layout: fixed;
  font-size: 9pt;
}
.rx-tbl col.col-med { width: 2.88in; }
.rx-tbl col.col-dur { width: 0.95in; }
.rx-tbl col.col-ind { width: 0.92in; }
.rx-tbl th, .rx-tbl td {
  border: 1px solid #000;
  vertical-align: top;
  box-sizing: border-box;
}
.rx-tbl th {
  font-size: 10pt;
  font-weight: 700;
  text-align: center;
  height: 0.28in;
  padding: 1px 2px;
  vertical-align: middle;
}
.rx-tbl td.h-empty {
  height: 0.28in;
  padding: 0;
  border: none;
}
.rx-row td { min-height: 0.6in; padding: 3px 5px 3px; }
.rx-med { position: relative; min-height: 0.6in; }
.rx-med-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; min-height: 0.19in; }
.rx-med-name { font-size: 10.5pt; font-weight: 700; line-height: 1.15; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.rx-qty { font-size: 10.5pt; font-weight: 700; white-space: nowrap; line-height: 1.15; }
.rx-qty .u { min-width: 0.4in; text-align: center; }
.rx-sig {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 8.5pt;
  margin-top: 0.02in;
  line-height: 1.15;
}
.sig-k {
  flex: none;
  white-space: nowrap;
  font-weight: 700;
}
.sig-free {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.15;
  font-size: 8.5pt;
}
.sig-long { font-size: 8pt; }
.meal {
  flex: none;
  font-size: 8pt;
  white-space: nowrap;
  margin-left: 4px;
}
.rx-slots {
  text-align: center;
  margin-top: 0.03in;
  font-size: 8pt;
  white-space: nowrap;
  line-height: 1.2;
}
.slot { display: inline; }
.slot.pill {
  display: inline-block;
  border: 1.5px solid #111;
  border-radius: 999px;
  padding: 0 4px;
  margin: 0 -2px;
  box-sizing: border-box;
  line-height: 1.15;
  font-weight: 700;
}
.faint { color: #999; }
.slot-note {
  font-size: 8pt;
  color: #444;
  font-style: italic;
}
.rx-dur { font-size: 8pt; line-height: 1.3; }
.rx-dur > div { white-space: nowrap; }
.dur-m { margin-bottom: 3px; }
.cb {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1px solid #000;
  text-align: center;
  font-size: 9px;
  line-height: 9px;
  font-weight: 700;
  vertical-align: middle;
  margin-right: 2px;
}
.dur-u { min-width: 0.34in; width: 0.36in; font-size: 12pt; font-weight: 700; text-align: center; line-height: 1.1; }
.rx-ind { font-size: 8.5pt; overflow-wrap: anywhere; line-height: 1.2; }
.rx-roomy .rx-row td { padding: 8px 6px 10px; }
.rx-roomy .rx-med { min-height: 0.92in; }
.rx-roomy .rx-med-top { min-height: 0.24in; }
.rx-roomy .rx-med-name, .rx-roomy .rx-qty { font-size: 13pt; }
.rx-roomy .rx-sig, .rx-roomy .sig-free { font-size: 10.5pt; }
.rx-roomy .rx-sig { margin-top: 0.08in; }
.rx-roomy .sig-long { font-size: 9.5pt; }
.rx-roomy .meal { font-size: 9.5pt; }
.rx-roomy .rx-slots { font-size: 8.5pt; margin-top: 0.1in; }
.rx-roomy .slot-note { font-size: 9pt; }
.rx-roomy .rx-dur { font-size: 9pt; }
.rx-roomy .dur-u { font-size: 15pt; width: 0.4in; }
.rx-roomy .cb { width: 11px; height: 11px; font-size: 10px; line-height: 10px; }
.rx-roomy .rx-ind { font-size: 9.5pt; }
.rx-airy .rx-row td { padding: 15px 5px 15px; }
.form-tall.form-rx { display: flow-root; }
/* JJQR - END */
.rx-next {
  position: absolute;
  left: 0.41in;
  top: 7.86in;
  font-size: 7.5pt;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.rx-next .next-u { width: 1.5in; min-width: 1.5in; }
.rx-sig-block {
  position: absolute;
  left: 55%;
  right: var(--pad-r);
  top: 7.54in;
}
.form-rx .sig-name { font-size: 7.5pt; height: 0.17in; line-height: 0.17in; }
.form-rx .sig-row { font-size: 7.5pt; height: 0.17in; margin: 0; line-height: 0.17in; }
.form-tall .rx-tbl {
  position: relative;
  top: auto;
  margin: 2.58in 0 0 0.43in; /* JJQR - AI (2026-11-26) - GAV-14: same start as the one-page table (was 2.87in) JJQR - END */
}
.form-tall .rx-next {
  position: relative;
  top: auto;
  left: auto;
  margin: 0.35in 0 0.2in 0.41in;
}
.form-tall .rx-sig-block {
  position: relative;
  top: auto;
  left: auto;
  right: auto;
  margin: 0.15in var(--pad-r) 0.2in 55%;
}
`;

  const next = opts.nextAppointment ?? "";
  const inner =
    letterheadHtml(opts.origin) +
    '<div class="rule-double"></div>' +
    '<div class="rx-name"><span>Patient\'s Name:</span><span class="u grow">' +
    e(opts.patient.full_name) +
    "</span></div>" +
    '<div class="rx-age"><span>Age:</span><span class="u age">' +
    e(opts.age) +
    "</span></div>" +
    '<div class="rx-sex"><span>Sex:</span><span class="u sex">' +
    e(opts.patient.sex) +
    "</span></div>" +
    '<div class="rx-addr"><span>Address:</span><span class="u grow">' +
    e(opts.patient.address) +
    "</span></div>" +
    '<div class="rx-date"><span>Date:</span><span class="u date">' +
    e(opts.date) +
    "</span></div>" +
    '<img class="rx-img" src="' + asset(opts.origin, "rx.png") + '" alt="Rx" />' +
    '<table class="rx-tbl">' +
      "<colgroup><col class=\"col-med\" /><col class=\"col-dur\" /><col class=\"col-ind\" /></colgroup>" +
      "<thead><tr><td class=\"h-empty\"></td><th>DURATION</th><th>INDICATION</th></tr></thead>" +
      "<tbody>" + rows.join("") + "</tbody>" +
    "</table>" +
    '<div class="rx-next"><span>Next appointment:</span><span class="u next-u">' +
    e(next) +
    "</span></div>" +
    '<div class="rx-sig-block">' +
    signatureBlock(opts.doctor) +
    "</div>";

  return (
    "<style>" + css + "</style>" +
    '<div class="form form-rx' + (tall ? " form-tall" : "") + (layout.roomy ? " rx-roomy" : layout.airy ? " rx-airy" : "") + '">' + inner + "</div>" //JJQR - AI (2026-11-26) - GAV-14 roomy / airy size class //JJQR - END
  );
}

function normLab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchLabItem(ordered: string, item: string): boolean {
  const o = ordered.toLowerCase();
  const n = normLab(ordered);
  const i = normLab(item);
  if (n === i) return true;
  if (i.indexOf("dengue") >= 0 && o.indexOf("dengue") >= 0) return true;
  if (i.indexOf("ecg") >= 0 && o.indexOf("ecg") >= 0) return true;
  if (item === "CREA" && (n === "crea" || o.indexOf("creatinine") >= 0)) return true;
  if (i.length > 0 && (" " + n + " ").indexOf(" " + i + " ") >= 0) return true; //JJQR - AI (Nov 24, 2026) - the whole test name appears in what was ordered //JJQR - END
  if (item === "LIPID PROFILE" && o.indexOf("lipid") >= 0) return true;
  //JJQR - AI (Nov 24, 2026) - thyroid and HbA1c names as a doctor might type them
  if (item === "TSH" && (/(^| )tsh( |$)/.test(" " + n + " ") || o.indexOf("thyroid stimulating") >= 0)) return true;
  if (item === "FT3" && (/(^| )ft3( |$)/.test(" " + n + " ") || /free t ?3/.test(o))) return true;
  if (item === "FT4" && (/(^| )ft4( |$)/.test(" " + n + " ") || /free t ?4/.test(o))) return true;
  if (item === "HbA1c" && (/hb ?a1c/.test(o) || o.indexOf("glycated") >= 0 || o.indexOf("glycosylated") >= 0 || /(^| )a1c( |$)/.test(" " + n + " "))) return true;
  //JJQR - END
  if (item === "URINALYSIS" && (o.indexOf("urinalysis") >= 0 || /(^| )urine( |$)/.test(" " + n + " "))) return true;
  return false;
}

function labMatch(tests: string[], items: string[]): { checked: { [k: string]: boolean }; extras: string[] } {
  const checked: { [k: string]: boolean } = {};
  const extras: string[] = [];
  for (let t = 0; t < tests.length; t++) {
    const test = tests[t];
    let hit = "";
    for (let i = 0; i < items.length; i++) {
      if (matchLabItem(test, items[i])) {
        hit = items[i];
        break;
      }
    }
    if (hit) checked[hit] = true;
    else extras.push(test);
  }
  return { checked: checked, extras: extras };
}

function labItemHtml(name: string, on: boolean, c: number, top: string): string {
  const tick = on ? '<span class="tick">✓</span>' : "";
  return (
    '<div class="lab-item lab-c' + c + '" style="top:' + top + '"><span class="lab-blank">' +
    tick +
    '___</span><span class="lab-name">' +
    e(name) +
    "</span></div>"
  );
}

//JJQR - AI (Nov 24, 2026) - owner: the lab request is re-laid out on the SAME A5 sheet as the prescription and the medical certificate (same letterhead, same patient lines, same signature block).
export function buildLabRequestHtml(opts: LabHtmlOpts): string {
  const items = normalizeLabItems(opts.items);
  const matched = labMatch(opts.tests, items);
  // two columns, filled top to bottom; with more than 14 tests the rows move closer so everything still fits above "Others:"
  const perCol = Math.ceil(items.length / 2);
  const step = perCol <= 7 ? 40 : Math.floor(240 / (perCol - 1));
  let list = "";
  for (let i = 0; i < items.length; i++) {
    const col = i < perCol ? 0 : 1;
    const row = col === 0 ? i : i - perCol;
    list += labItemHtml(items[i], !!matched.checked[items[i]], col, labTop(295 + row * step));
  }

  let extras = "";
  if (matched.extras.length) {
    extras =
      '<div class="lab-others"><div class="lab-others-lbl">Others:</div>' +
      matched.extras.map(function (x) { return '<div class="lab-extra">' + e(x) + "</div>"; }).join("") +
      "</div>";
  }

  const dxBits: string[] = [];
  if (opts.diagnoses && opts.diagnoses.length) dxBits.push(opts.diagnoses.join("; "));
  if (opts.clinicalNotes && opts.clinicalNotes.trim()) dxBits.push(opts.clinicalNotes.trim());
  const dx = dxBits.length
    ? '<div class="lab-dx"><span class="lab-dx-lbl">Dx:</span> ' + e(dxBits.join(" — ")) + "</div>"
    : "";

  const css =
    shellCss(opts.pageSize, "148mm", "210mm") +
    a5LetterheadCss("1.58in") +
    `
.form-lab {
  width: 148mm;
  height: 210mm;
  --pad-l: 0.35in;
  --pad-r: 0.65in;
}
.rx-name, .rx-addr, .rx-age, .rx-sex, .rx-date {
  position: absolute;
  font-size: 7.5pt;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.rx-name {
  top: 1.77in;
  left: var(--pad-l);
  right: 35%;
}
.rx-age {
  top: 1.77in;
  left: 66%;
  right: 24%;
}
.rx-sex {
  top: 1.77in;
  left: 77%;
  right: var(--pad-r);
}
.rx-addr {
  top: 1.98in;
  left: var(--pad-l);
  right: 35%;
}
.rx-date {
  top: 1.98in;
  left: 66%;
  right: var(--pad-r);
  white-space: nowrap;
}
.rx-name .u, .rx-addr .u, .rx-date .u { flex: 1; min-width: 0; }
.rx-age .u { width: 0.42in; min-width: 0.42in; }
.rx-sex .u { flex: 1; min-width: 0.4in; }
.lab-rx {
  position: absolute;
  left: var(--pad-l);
  top: 2.4in;
  width: 0.6in;
  height: 0.6in;
  font: 800 38px/1 "Arial Black", Arial, sans-serif;
  letter-spacing: -1px;
  color: #000;
}
.lab-rx-x {
  font-size: 30px;
  position: relative;
  top: 6px;
}
.lab-item {
  position: absolute;
  font-size: 11pt;
  font-weight: 700;
  line-height: 0.25in;
  height: 0.25in;
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
  white-space: nowrap;
}
.lab-c0 { left: 1.0in; }
.lab-c1 { left: 3.0in; }
.lab-blank {
  position: relative;
  display: inline-block;
  width: 0.32in;
  font-weight: 400;
  font-size: 9pt;
  letter-spacing: -0.02em;
}
.lab-name { font-weight: 700; }
.tick {
  position: absolute;
  left: 0;
  top: -0.15em;
  font-weight: 700;
  font-size: 12pt;
  line-height: 1;
}
.lab-others {
  position: absolute;
  left: var(--pad-l);
  right: var(--pad-r);
  top: 5.85in;
  font-size: 8.5pt;
  line-height: 0.2in;
}
.lab-others-lbl { font-weight: 700; }
.lab-extra { white-space: nowrap; }
.lab-dx {
  position: absolute;
  left: var(--pad-l);
  right: var(--pad-r);
  top: 6.5in;
  font-size: 7.5pt;
  line-height: 1.3;
}
.lab-dx-lbl { font-weight: 700; }
.lab-cartoon {
  position: absolute;
  left: var(--pad-l);
  top: 6.95in;
  width: 0.55in;
  height: 1.15in;
  object-fit: contain;
  object-position: bottom left;
}
.rx-sig-block {
  position: absolute;
  left: 55%;
  right: var(--pad-r);
  top: 7.54in;
}
.form-lab .sig-name { font-size: 7.5pt; height: 0.17in; line-height: 0.17in; }
.form-lab .sig-row { font-size: 7.5pt; height: 0.17in; margin: 0; line-height: 0.17in; }
`;

  const inner =
    letterheadHtml(opts.origin) +
    '<div class="rule-double"></div>' +
    '<div class="rx-name"><span>Patient\'s Name:</span><span class="u grow">' +
    e(opts.patient.full_name) +
    "</span></div>" +
    '<div class="rx-age"><span>Age:</span><span class="u age">' +
    e(opts.age) +
    "</span></div>" +
    '<div class="rx-sex"><span>Sex:</span><span class="u sex">' +
    e(opts.patient.sex) +
    "</span></div>" +
    '<div class="rx-addr"><span>Address:</span><span class="u grow">' +
    e(opts.patient.address) +
    "</span></div>" +
    '<div class="rx-date"><span>Date:</span><span class="u date">' +
    e(opts.date) +
    "</span></div>" +
    '<div class="lab-rx">R<span class="lab-rx-x">x</span></div>' +
    '<div class="lab-list">' + list + "</div>" +
    extras +
    dx +
    '<img class="lab-cartoon" src="' + asset(opts.origin, "cartoon.png") + '" alt="" />' +
    '<div class="rx-sig-block">' +
    signatureBlock(opts.doctor) +
    "</div>";

  return "<style>" + css + '</style><div class="form form-lab">' + inner + "</div>";
}
//JJQR - END
