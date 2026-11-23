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

const LAB_ITEMS = [
  { name: "CBC", y: "2.94in" },
  { name: "URINALYSIS", y: "3.13in" },
  { name: "LIPID PROFILE", y: "3.31in" },
  { name: "SGPT", y: "3.49in" },
  { name: "CREA", y: "3.68in" },
  { name: "FBS", y: "3.87in" },
  { name: "BUA", y: "4.05in" },
  { name: "DENGUE NS1, IgG, IgM", y: "4.40in" },
  { name: "ECG 12L", y: "5.15in" },
];

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
    credLine("License No:", doctor.license_number ?? ""),
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

.form-mc .ln { width: auto; }`; //JJQR - AI (Nov 23, 2026) - every pinned line used width:100% inside the left/right margins, so its underline ran past the right margin to the page edge. Let it fill only the margin box (the desktop already did; keeps both prints identical) //JJQR - END

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
    '<div class="write mc-diag"><div class="write-lines"><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>' +
    '<div class="write-text">' +
    '<span class="write-lbl">Diagnosis/ Impressions:</span>' +
    flat(opts.diagnosis) +
    "</div></div>" +
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

function sigFreeText(item: HtmlRxLine): string {
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

export function buildPrescriptionHtml(opts: RxHtmlOpts): string {
  //JJQR - AI (Nov 20, 2026)
  const rows: string[] = [];
  for (let i = 0; i < opts.items.length; i++) {
    rows.push(rxRow(opts.items[i]));
  }
  const tall = opts.items.length > 5;
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
.rx-tbl {
  position: absolute;
  left: 0.43in;
  top: 2.87in;
  border-collapse: collapse;
  width: 4.67in;
  table-layout: fixed;
  font-size: 8pt;
}
.rx-tbl col.col-med { width: 2.73in; }
.rx-tbl col.col-dur { width: 1.0in; }
.rx-tbl col.col-ind { width: 0.94in; }
.rx-tbl th, .rx-tbl td {
  border: 1px solid #000;
  vertical-align: top;
  box-sizing: border-box;
}
.rx-tbl th {
  font-size: 8.75pt;
  font-weight: 700;
  text-align: center;
  height: 0.33in;
  padding: 1px 2px;
  vertical-align: middle;
}
.rx-tbl td.h-empty {
  height: 0.33in;
  padding: 0;
  border: none;
}
.rx-row td { min-height: 0.575in; padding: 2px 4px 1px; }
.rx-med { position: relative; min-height: 0.535in; }
.rx-med-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; min-height: 0.18in; }
.rx-med-name { font-size: 8.5pt; flex: 1; min-width: 0; }
.rx-qty { font-size: 8pt; white-space: nowrap; }
.rx-qty .u { min-width: 0.45in; }
.rx-sig {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 7pt;
  margin-top: 0.02in;
}
.sig-k {
  flex: none;
  white-space: nowrap;
}
.sig-free {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.2;
  font-size: 7pt;
}
.sig-long { font-size: 6.2pt; }
.meal {
  flex: none;
  font-size: 6.5pt;
  white-space: nowrap;
  margin-left: 4px;
}
.rx-slots {
  text-align: center;
  margin-top: 0.04in;
  font-size: 7pt;
  white-space: nowrap;
}
.slot { display: inline; }
.slot.pill {
  display: inline-block;
  border: 1px solid #111;
  border-radius: 999px;
  padding: 0 3px;
  margin: 0 -2px;
  box-sizing: border-box;
  line-height: 1.15;
  /* JJQR - AI (Nov 20, 2026) */
  font-weight: 700;
}
.faint { color: #aaa; }
.slot-note {
  font-size: 6pt;
  color: #555;
  font-style: italic;
}
/* JJQR - END */
.rx-dur { font-size: 6pt; line-height: 1.35; }
.dur-m { margin-bottom: 1px; }
.cb {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 1px solid #000;
  text-align: center;
  font-size: 7px;
  line-height: 7px;
  font-weight: 700;
  vertical-align: middle;
  margin-right: 2px;
}
.dur-u { min-width: 0.28in; width: 0.32in; }
.rx-ind { font-size: 7pt; word-break: break-word; }
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
  margin: 2.87in 0 0 0.43in;
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
    '<div class="form form-rx' + (tall ? " form-tall" : "") + '">' + inner + "</div>"
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
  if (item === "LIPID PROFILE" && o.indexOf("lipid") >= 0) return true;
  if (item === "URINALYSIS" && (o.indexOf("urinalysis") >= 0 || /(^| )urine( |$)/.test(" " + n + " "))) return true;
  return false;
}

function labMatch(tests: string[]): { checked: { [k: string]: boolean }; extras: string[] } {
  const checked: { [k: string]: boolean } = {};
  const extras: string[] = [];
  for (let t = 0; t < tests.length; t++) {
    const test = tests[t];
    let hit = "";
    for (let i = 0; i < LAB_ITEMS.length; i++) {
      if (matchLabItem(test, LAB_ITEMS[i].name)) {
        hit = LAB_ITEMS[i].name;
        break;
      }
    }
    if (hit) checked[hit] = true;
    else extras.push(test);
  }
  return { checked: checked, extras: extras };
}

function labItemHtml(name: string, on: boolean, y: string): string {
  const tick = on ? '<span class="tick">✓</span>' : "";
  return (
    '<div class="lab-item" style="top:' + y + '"><span class="lab-blank">' +
    tick +
    '___</span><span class="lab-name">' +
    name +
    "</span></div>"
  );
}

export function buildLabRequestHtml(opts: LabHtmlOpts): string {
  const matched = labMatch(opts.tests);
  let list = "";
  for (let i = 0; i < LAB_ITEMS.length; i++) {
    const row = LAB_ITEMS[i];
    list += labItemHtml(row.name, !!matched.checked[row.name], row.y);
  }

  let extras = "";
  if (matched.extras.length) {
    extras =
      '<div class="lab-extras">' +
      matched.extras.map(function (x) { return '<div class="lab-extra">' + e(x) + "</div>"; }).join("") +
      "</div>";
  }

  const dxBits: string[] = [];
  if (opts.diagnoses && opts.diagnoses.length) dxBits.push(opts.diagnoses.join("; "));
  if (opts.clinicalNotes && opts.clinicalNotes.trim()) dxBits.push(opts.clinicalNotes.trim());
  const dx = dxBits.length
    ? '<div class="lab-dx"><div class="lab-dx-lbl">Dx:</div>' + e(dxBits.join(" — ")) + "</div>"
    : "";

  const sigWritten = labSigName(opts.doctor);
  const css =
    shellCss(opts.pageSize, "4.3in", "6.4in") +
    `
.form-lab {
  width: 4.3in;
  height: 6.4in;
  --pad-l: 0.27in;
  --pad-r: 0.6in;
}
.form-lab .lh { height: 1.15in; }
.form-lab .lh-logo {
  left: 0.28in;
  top: 0.38in;
  width: 0.32in;
  height: auto;
}
.form-lab .lh-seal {
  left: 3.46in;
  top: 0.40in;
  width: 0.34in;
  height: auto;
}
.form-lab .lh-doc {
  left: 2.04in;
  top: 0.48in;
  transform: translate(-50%, -50%);
  font-size: 8.8pt;
  line-height: 0.14in;
}
.form-lab .lh-fam {
  left: 2.04in;
  top: 0.62in;
  transform: translate(-50%, -50%);
  font-size: 5.6pt;
  line-height: 0.11in;
}
.form-lab .lh-adult {
  left: 2.04in;
  top: 0.73in;
  transform: translate(-50%, -50%);
  font-size: 5.6pt;
  line-height: 0.11in;
}
.form-lab .lh-c1, .form-lab .lh-c2, .form-lab .lh-c3, .form-lab .lh-c4 {
  left: 0.76in;
  font-size: 4.6pt;
  line-height: 0.083in;
  transform: translateY(-50%);
}
.form-lab .lh-c1 { top: 0.85in; }
.form-lab .lh-c2 { top: 0.93in; }
.form-lab .lh-c3 { top: 1.02in; }
.form-lab .lh-c4 { top: 1.09in; }
.form-lab .lh-r1d, .form-lab .lh-r3d {
  left: 2.2in;
  font-size: 4.6pt;
  line-height: 0.083in;
  transform: translateY(-50%);
}
.form-lab .lh-r1d { top: 0.85in; }
.form-lab .lh-r3d { top: 1.02in; }
.form-lab .lh-r1t, .form-lab .lh-r2t, .form-lab .lh-r3t {
  left: 3.4in;
  font-size: 4.6pt;
  line-height: 0.083in;
  transform: translate(-100%, -50%);
}
.form-lab .lh-r1t { top: 0.85in; }
.form-lab .lh-r2t { top: 0.93in; }
.form-lab .lh-r3t { top: 1.02in; }
.form-lab .rule-single {
  position: absolute;
  top: 1.15in;
  left: 0.27in;
  width: 3.43in;
}
.lab-id-name, .lab-id-addr {
  position: absolute;
  left: var(--pad-l);
  right: var(--pad-r);
  font-size: 6pt;
  display: flex;
  align-items: flex-end;
  gap: 6px;
}
.lab-id-name { top: 1.38in; }
.lab-id-addr { top: 1.53in; }
.lab-ids-left { flex: 1; display: flex; align-items: flex-end; gap: 3px; min-width: 0; }
.lab-ids-left .u { flex: 1; min-width: 0; }
.lab-ids-right { display: flex; align-items: flex-end; gap: 4px; flex: 0 0 38%; }
.lab-ids-right .u.date { flex: 1; min-width: 0.55in; }
.lab-ids-right .u.age, .lab-ids-right .u.sex { width: 0.38in; min-width: 0.32in; }
.lab-rx {
  position: absolute;
  left: var(--pad-l);
  top: 1.9in;
  width: 0.42in;
  height: 0.4in;
  font: 800 28px/1 "Arial Black", Arial, sans-serif;
  letter-spacing: -1px;
  color: #000;
}
.lab-rx-x {
  font-size: 22px;
  position: relative;
  top: 4px;
}
.lab-item {
  position: absolute;
  left: 1.07in;
  font-size: 11pt;
  font-weight: 700;
  line-height: 0.185in;
  height: 0.185in;
  margin-top: -0.12in;
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
  white-space: nowrap;
}
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
.lab-extras {
  position: absolute;
  left: 0.05in;
  top: 3.3in;
  width: 0.85in;
  font-size: 11pt;
  font-family: "Bradley Hand", "Segoe Script", "Comic Sans MS", cursive;
  color: #1a2332;
  line-height: 0.3in;
}
.lab-extra {
  transform: rotate(-20deg);
  transform-origin: left center;
  white-space: nowrap;
  height: 0.3in;
}
.lab-dx {
  position: absolute;
  left: 2.5in;
  top: 2.5in;
  right: var(--pad-r);
  font-size: 6pt;
  line-height: 1.3;
}
.lab-dx-lbl { font-weight: 700; }
.lab-cartoon {
  position: absolute;
  left: 0.08in;
  top: 5.0in;
  width: 0.55in;
  height: 1.3in;
  object-fit: contain;
  object-position: bottom left;
}
.lab-sig {
  position: absolute;
  left: 1.95in;
  right: var(--pad-r);
  top: 5.72in;
  font-size: 6.7pt;
}
.lab-sig-name {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  border-bottom: 1px solid #333;
  min-height: 0.16in;
  position: absolute;
  left: 0;
  right: 0;
  top: 0.16in;
}
.lab-sig-written {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: visible;
  font-size: 6pt;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-0.05in);
}
.lab-md {
  flex: 0 0 auto;
  margin-left: auto;
  padding-left: 2px;
  line-height: 1;
}
.lab-lic {
  position: absolute;
  left: 0;
  right: 0;
  top: 0.35in;
  font-size: 6.5pt;
}
.lab-ptr {
  position: absolute;
  left: 0;
  right: 0;
  top: 0.51in;
  font-size: 6.5pt;
}
.lab-sig .sig-row { font-size: 6.5pt; margin: 0; }
.lab-sig .sig-lbl { white-space: nowrap; }
`;

  const inner =
    letterheadHtml(opts.origin) +
    '<div class="rule-single"></div>' +
    '<div class="lab-id-name">' +
      '<div class="lab-ids-left"><span>Patient Name:</span><span class="u grow">' +
      e(opts.patient.full_name) +
      "</span></div>" +
      '<div class="lab-ids-right"><span>Date:</span><span class="u date">' +
      e(opts.date) +
      "</span></div>" +
    "</div>" +
    '<div class="lab-id-addr">' +
      '<div class="lab-ids-left"><span>Address:</span><span class="u grow">' +
      e(opts.patient.address) +
      "</span></div>" +
      '<div class="lab-ids-right"><span>Age:</span><span class="u age">' +
      e(opts.age) +
      '</span><span>Sex:</span><span class="u sex">' +
      e(opts.patient.sex) +
      "</span></div>" +
    "</div>" +
    '<div class="lab-rx">R<span class="lab-rx-x">x</span></div>' +
    extras +
    '<div class="lab-list">' + list + "</div>" +
    dx +
    '<img class="lab-cartoon" src="' + asset(opts.origin, "cartoon.png") + '" alt="" />' +
    '<div class="lab-sig">' +
      '<div class="lab-sig-name"><span class="lab-sig-written" style="font-size:' +
      labSigFontSize(sigWritten) +
      '">' + e(sigWritten) +
      '</span><span class="lab-md">MD</span></div>' +
      '<div class="lab-lic">' + credLine("LIC No:", opts.doctor.license_number ?? "") + "</div>" +
      '<div class="lab-ptr">' + credLine("PTR No:", opts.doctor.ptr_number ?? "") + "</div>" +
    "</div>";

  return "<style>" + css + '</style><div class="form form-lab">' + inner + "</div>";
}
