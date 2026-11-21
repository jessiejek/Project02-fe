//JJQR - AI (Nov 21, 2026) - lab-form Dx, Completion Checklist contents, "Save & next"
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLabRequestHtml } from "./print-forms-html.ts";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const page = () => read("../app/doctor/consultation2/[bookingId]/page.tsx");

// ── Lab request Dx: the impression only, never the Plan ─────────────────────

test("lab request Dx comes from the Assessment only (page + saved-consult fallback)", () => {
  const src = page();
  assert.match(src, /clinicalNotes: assessment\.trim\(\)/);
  assert.equal(src.includes('clinicalNotes: [assessment, plan]'), false);
  const print = read("./consult-print.ts");
  assert.match(print, /return \(consult\.assessment \?\? ""\)\.trim\(\);/);
  assert.equal(print.includes("[consult.assessment, consult.plan]"), false);
});

test("a lab form with an Assessment prints it under Dx, and one without prints no Dx box", () => {
  const base = { origin: "http://forms.test", pageSize: "4.3in 6.4in", doctor: { full_name: "Jane Doe", license_number: "LIC-99", ptr_number: "PTR-88", s2_number: "S2-77" }, patient: { full_name: "Juan Dela Cruz", sex: "Male", address: "Buaya, Lapu Lapu City" }, age: "36", date: "November 21, 2026", tests: ["CBC"] };
  const withDx = buildLabRequestHtml({ ...base, diagnoses: [], clinicalNotes: "Acute gastroenteritis, likely viral; mild dehydration." });
  assert.ok(withDx.includes("Dx:") && withDx.includes("Acute gastroenteritis, likely viral"));
  assert.equal(withDx.includes("Oral rehydration"), false); // plan wording never reaches the form
  assert.equal(buildLabRequestHtml({ ...base, diagnoses: [], clinicalNotes: "" }).includes("Dx:"), false);
});

// ── Completion Checklist shows what was entered ─────────────────────────────

test("completion checklist: every row carries a summary of what was entered", () => {
  const src = page();
  assert.match(src, /function sectionSummary\(i: number\): string/);
  assert.match(src, /<p className="whitespace-pre-line pl-\[26px\] text-label-md text-on-surface-variant">\{sectionSummary\(i\)\}<\/p>/);
  // each visible section has its own summary case
  for (const n of [0, 1, 3, 4, 5, 6, 7, 8]) assert.match(src, new RegExp(`case ${n}:`));
  // the checklist list scrolls instead of growing past the screen
  assert.match(src, /max-h-\[60vh\][^"]*overflow-y-auto[^"]*" data-testid="completion-checklist"/);
});

test("completion checklist summary reads the live form state (notes, vitals, Rx, labs, follow-up, fee)", () => {
  const src = page();
  assert.match(src, /Chief complaint: \$\{clipText\(chiefComplaint\)\}/);
  assert.match(src, /Assessment: \$\{clipText\(assessment\)\}/);
  assert.match(src, /effectiveRxItems\.map\(\(rx\) => `\$\{rx\.genericName\}/);
  assert.match(src, /labOrders\.map\(\(l\) => l\.testName\.trim\(\)\)/);
  assert.match(src, /pfDecision === "charge" \? `Charge \$\{formatPeso\(Number\(pfAmountShown\) \|\| 0\)\}`/);
});

// ── Save & next ─────────────────────────────────────────────────────────────

test("Save & next: saves the draft, then moves on only if the save worked", () => {
  const src = page();
  assert.match(src, /async function handleSaveDraft\(\): Promise<boolean>/);
  assert.match(src, /const saved = await handleSaveDraft\(\); if \(saved && nextSection !== null\) stepSection\(nextSection\);/);
  assert.match(src, /nextSection !== null \? "Save & next" : "Save draft"/);
  // a failed save returns false (so you stay put); nothing-new-to-save counts as saved
  const fn = src.slice(src.indexOf("async function handleSaveDraft"), src.indexOf("const latestDraftSave"));
  assert.match(fn, /return false;[\s\S]*return true;[\s\S]*return true;[\s\S]*return false;/);
});

test("Prev / Next still never save, and amend mode keeps 'Save amendment'", () => {
  const src = page();
  assert.match(src, /onClick=\{\(\) => stepSection\(nextSection\)\} aria-label="Next section"/);
  assert.match(src, /"Save amendment"\}<\/Button>/);
});
//JJQR - END

//JJQR - AI (Nov 21, 2026) - Professional Fee decision: required, always the last step, Charge or Waive
test("fee decision is required for Review & complete", () => {
  const src = page();
  assert.match(src, /const REQUIRED_SECTIONS = \[0, 1, 2, 3, 6, 8\]/);
  assert.match(src, /const FEE_SECTION_INDEX = 8;/);
  // the gate itself: a Waive needs a reason (5+ chars), a Charge needs an amount
  assert.match(src, /pfDecision === "charge" \? Number\.isFinite\(Number\(pfAmountShown\)\) && pfAmountShown\.trim\(\) !== "" && Number\(pfAmountShown\) > 0 && Number\(pfAmountShown\) <= 100_000 : pfWaiveReason\.trim\(\)\.length >= 5/);
});

test("fee decision is not hidden behind More and is rendered last, after the More toggle", () => {
  const src = page();
  assert.match(src, /const OCCASIONAL_SECTIONS = \[5\] as const;/);
  assert.match(src, /const SECTION_ORDER = \[0, 1, 2, 3, 4, 6, 7, 5, 8\] as const;/); // 8 stays last in the order
  const moreAt = src.indexOf('{showOccasional ? "Less" : "More"}');
  const feeAt = src.indexOf('data-testid="consult-fee-step"');
  assert.ok(moreAt > 0 && feeAt > moreAt, "fee step button must come after the More toggle");
  assert.match(src, /visibleSectionOrder\.map\(\(i, displayIdx\) => i === FEE_SECTION_INDEX \? null : \(/);
});

test("fee step: 'Decide at desk' is gone and the doctor sees plainly whether the patient is charged or waived", () => {
  const src = page();
  assert.equal(/Decide at desk\s*<\/button>/.test(src), false);
  assert.match(src, /data-testid="fee-decision-banner"/);
  assert.match(src, /Final step — decide the professional fee for this visit\./);
  assert.match(src, /This patient will be charged \$\{formatPeso\(Number\(pfAmountShown\) \|\| 0\)\}\./);
  assert.match(src, /The professional fee will be waived: \$\{pfWaiveReason\.trim\(\)\}/);
});

test("completed visits saved with the old 'Decide at desk' still display it (history is not rewritten)", () => {
  assert.match(page(), /Professional fee: Decide at desk/);
});
//JJQR - END

//JJQR - AI (Nov 21, 2026) - the final action sits last in the footer
test("footer order: Prev, Next, Save & next, then Review & complete at the far end", () => {
  const src = page();
  const next = src.indexOf('data-testid="consult-next-section"');
  const save = src.indexOf('data-testid="consult-save"');
  const review = src.indexOf('aria-label="Complete Consultation">Review');
  assert.ok(next > 0 && save > next && review > save, "Review & complete must come after Save & next");
});
//JJQR - END
