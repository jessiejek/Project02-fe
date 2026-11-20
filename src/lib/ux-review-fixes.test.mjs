//JJQR - AI (Nov 20, 2026) - tests for the doctor-portal UX review fixes
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPrnFollowUp, followUpViewLine } from "./pf-default.ts";
import { formatClinicDateShort } from "./format.ts";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const dashboard = () => read("../app/doctor/dashboard/page.tsx");
const consult = () => read("../app/doctor/consultation2/[bookingId]/page.tsx");

// ── PRN follow-ups ──────────────────────────────────────────────────────────

test("isPrnFollowUp: the default PRN reason and instructions are PRN", () => {
  assert.equal(isPrnFollowUp({ reason: "PRN / return if needed", instructions: null }), true);
  assert.equal(isPrnFollowUp({ reason: null, instructions: "PRN — return if symptoms recur" }), true);
  assert.equal(isPrnFollowUp({ reason: "prn", instructions: "" }), true);
});

test("isPrnFollowUp: a real dated follow-up and missing data are not PRN", () => {
  assert.equal(isPrnFollowUp({ reason: "Recheck BP", instructions: "Bring BP log" }), false);
  assert.equal(isPrnFollowUp({ reason: null, instructions: null }), false);
  assert.equal(isPrnFollowUp(null), false);
  assert.equal(isPrnFollowUp(undefined), false);
});

test("followUpViewLine: PRN shows no date and says PRN once", () => {
  const line = followUpViewLine(
    { date: "2026-11-20", reason: "PRN / return if needed", instructions: "PRN — return if symptoms recur", reminder: false },
    (d) => `FORMATTED(${d})`,
  );
  assert.equal(line, "PRN — return if symptoms recur");
  assert.equal(/2026|FORMATTED/.test(line), false);
  assert.equal((line.match(/PRN/g) ?? []).length, 1);
});

test("followUpViewLine: dated follow-up uses the friendly date, never ISO", () => {
  const line = followUpViewLine(
    { date: "2026-11-27", reason: "Recheck BP", instructions: "Bring BP log", reminder: true },
    (d) => formatClinicDateShort(d, d),
  );
  assert.equal(line, "Nov 27, 2026 — Recheck BP (Bring BP log) · reminder on");
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(line), false);
});

test("followUpViewLine: dated with no reason has no dangling dash; none says so", () => {
  assert.equal(
    followUpViewLine({ date: "2026-11-27", reason: "", instructions: "", reminder: false }, (d) => formatClinicDateShort(d, d)),
    "Nov 27, 2026",
  );
  assert.equal(followUpViewLine({ date: null }, (d) => d), "No follow-up recorded.");
  assert.equal(followUpViewLine(null, (d) => d), "No follow-up recorded.");
});

// ── Dashboard "Needs attention" ────────────────────────────────────────────

test("dashboard: every Needs attention row names the patient (no more identical rows)", () => {
  const src = dashboard();
  assert.match(src, /const attentionName = /);
  assert.match(src, /attentionName\(c\.booking_id\)\} — Assessment and Plan are blank/);
  assert.match(src, /attentionName\(c\.booking_id\)\} — follow-up due today/);
  // The old nameless rows are gone.
  assert.equal(src.includes(">Chart missing Assessment/Plan<"), false);
  assert.equal(src.includes(">Follow-up due today<"), false);
});

test("dashboard: names come from the queue board keyed by booking id", () => {
  assert.match(dashboard(), /new Map\(board\.items\.map\(\(e\) => \[e\.booking_id, e\.patient_name\]\)\)/);
});

test("dashboard: PRN follow-ups are not 'due today' and not in the 7-day count", () => {
  const src = dashboard();
  assert.match(src, /follow_up_date === today && !isPrnFollowUp\(c\.follow_ups\)/);
  assert.match(src, /!isPrnFollowUp\(\{ reason: r\.reason as string \| null \}\)/);
});

test("dashboard: Assessment/Plan flag only when BOTH are blank (Complete does not require them)", () => {
  const src = dashboard();
  assert.match(src, /!c\.assessment\?\.trim\(\) && !c\.plan\?\.trim\(\)/);
  assert.equal(/!c\.assessment\?\.trim\(\) \|\| !c\.plan\?\.trim\(\)/.test(src), false);
  // ...and the Complete gate really does not require them (the reason for the rule above).
  const gate = consult().slice(consult().indexOf("const sectionSatisfied = ["), consult().indexOf("const rxSatisfied"));
  assert.equal(/assessment|plan/i.test(gate), false);
});

test("dashboard: lists cut at 5 say so for charts and follow-ups, like the unpaid list", () => {
  const src = dashboard();
  assert.match(src, /consultationsToday\.length > 5/);
  assert.match(src, /followUpsDueToday\.length > 5/);
  assert.match(src, /more charts to finish — view all/);
  assert.match(src, /more follow-ups due — view all/);
});

test("ConsultationRow carries the follow-up reason so PRN can be told apart", () => {
  const src = read("./data/clinical.ts");
  assert.match(src, /follow_ups\?: \{ follow_up_date: string \| null; reason\?: string \| null; instructions: string \| null \}/);
  assert.match(src, /reason: \(f\.reason as string\) \?\? null/);
});

// ── Phone: header actions no longer run off-screen ─────────────────────────

test("DoctorPageHeader: actions wrapper can wrap on a phone (no shrink-0)", () => {
  const src = read("../components/doctor/DoctorPageHeader.tsx");
  assert.equal(/<div className="[^"]*shrink-0[^"]*">\{actions\}/.test(src), false);
  assert.match(src, /<div className="flex max-w-full flex-wrap items-center gap-sm">\{actions\}<\/div>/);
});

// ── Consult screen ──────────────────────────────────────────────────────────

test("consult: completed line and follow-up line use friendly dates, not ISO", () => {
  const src = consult();
  assert.equal(src.includes("Completed {booking.appointmentDate} by"), false);
  assert.match(src, /Completed \{formatClinicDateShort\(booking\.appointmentDate, booking\.appointmentDate\)\} by/);
  assert.match(src, /followUpViewLine\(/);
  assert.equal(src.includes("`${sc.followUpDate} — "), false);
  // review checklist summary too
  assert.equal(src.includes("? `${followUpDate}${followUpReason"), false);
});

test("consult: header is compact - title + visit toggle share a line, toolbar is one full-width row below desktop", () => {
  const src = consult();
  assert.match(src, /data-testid="consult-header"/);
  assert.match(src, /<div className="flex w-full flex-wrap gap-sm lg:w-auto">/);
  // compact buttons + the print pair are direct flex items so all five fit one tablet row
  assert.match(src, /consultPrintButtons\("contents", "!px-sm !py-sm"\)/);
  assert.match(src, /function consultPrintButtons\(className\?: string, buttonClassName\?: string\)/);
  assert.match(src, /className="!px-sm !py-sm" onClick=\{\(\) => setHistoryOpen\(true\)\}/);
  assert.match(src, /className="!px-sm !py-sm" onClick=\{requestCancelAmend\}/);
  // the other two print-bar call sites keep their own layout
  assert.match(src, /consultPrintButtons\("flex flex-col gap-sm sm:flex-row"\)/);
  // button texts the e2e specs rely on are untouched
  assert.match(src, /View Patient History/);
  assert.match(src, /Cancel amendment/);
});

test("consult: patient banner lets the name shrink so identity + allergy chips fit a tablet row", () => {
  const src = read("../components/doctor/ConsultPatientBanner.tsx");
  assert.match(src, /gap-x-md gap-y-xs py-xs/);
  assert.match(src, /min-w-\[9rem\] flex-1/);
  // the patient-name line specifically (a separate allergy text input elsewhere keeps its own 12rem)
  assert.equal(src.includes('<p className="min-w-[12rem] flex-1 text-body-md text-on-surface">'), false);
});

test("consult: read-only vitals show the same Out of range cue as the edit form", () => {
  const editor = read("../components/doctor/VitalsEditor.tsx");
  assert.match(editor, /export function vitalOutOfRange\(/);
  const src = consult();
  assert.match(src, /import \{ VitalsEditor, vitalOutOfRange \}/);
  assert.match(src, /vitalOutOfRange\(t\.formKey, filledVitals\[t\.formKey\] \?\? ""\)/);
});
//JJQR - END
