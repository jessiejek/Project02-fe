//JJQR - AI (Nov 20, 2026) C1–C6 — static source assertions for consultation2 simplify
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('app/doctor/consultation2/[bookingId]/page.tsx');
const combo = read('components/doctor/DiagnosisCombobox.tsx');
const nav = page.slice(page.indexOf('aria-label="Consultation sections"'), page.indexOf('min-w-0 space-y-md pb-[max(16rem'));
//JJQR - AI (Nov 20, 2026) - Vital Signs (1) and Prescription (3) stay mounted, so slice diagnosis to Lab Orders (4)
const dx = page.slice(page.indexOf('{isOpen && i === 2 &&'), page.indexOf('{isOpen && i === 4 &&'));

test('C1 diagnosis combobox: one input, saved then ICD-10, keyboard + a11y', () => {
  assert.doesNotMatch(dx, /Insert saved diagnosis/);
  assert.doesNotMatch(page, /Icd10DiagnosisField/);
  assert.match(page, /<DiagnosisCombobox/);
  assert.match(page, /addDiagnosisLine\(t\.body, t\.icd10_code \?\? null\)/);
  assert.match(combo, /role="combobox"/);
  assert.match(combo, /role="listbox"/);
  assert.match(combo, /role="option"/);
  assert.match(combo, /aria-activedescendant/);
  assert.match(combo, /My diagnoses/);
  assert.match(combo, /ICD-10/);
  assert.match(combo, /queryIcd10Codes\(null, q\)/);
  assert.match(combo, /slice\(0, 20\)/);
  assert.match(combo, /, 200\)/);
  assert.match(combo, /cancelled = true/);
  assert.match(combo, /e\.key === "Enter"/);
  assert.match(combo, /e\.key === "ArrowDown"/);
  assert.match(combo, /e\.key === "ArrowUp"/);
  assert.match(combo, /e\.key === "Escape"/);
  assert.match(combo, /onAdd\(opt\.row\.description, opt\.row\.code\)/);
  assert.match(combo, /onPickSaved\(opt\.template\)/);
  assert.match(combo, /aria-label="Diagnosis \(search ICD-10 or saved\)"/);
  assert.match(combo, /function commitTypedFreeText/);
  assert.match(combo, /onClick=\{commitTypedFreeText\}/);
  assert.match(combo, /onAdd\(trimmed, null\)/);
});

test('C2 save typed text is a list option that creates a diagnosis template then adds it', () => {
  assert.doesNotMatch(page, /Save typed text as a template/);
  assert.match(combo, /Save "\$\{opt\.text\}" to my diagnoses/);
  assert.match(combo, /isExactSavedDiagnosis/);
  assert.match(page, /createDiagnosisTemplate\(null as never, \{ label, body, icd10_code: null \}\)/);
  assert.match(page, /addDiagnosisLine\(created\.body, created\.icd10_code \?\? null\)/);
});

test('C3 one Manage link per section (diagnosis keeps Manage deep link, drops Manage templates)', () => {
  assert.match(dx, /manageTemplatesHref\("diagnoses"\)/);
  assert.match(dx, /aria-label="Manage"/);
  assert.match(dx, />\s*Manage\s*</);
  assert.doesNotMatch(dx, /Manage templates/);
  assert.equal((dx.match(/manageTemplatesHref/g) ?? []).length, 1);
  const soap = page.slice(page.indexOf('{isOpen && i === 0 &&'), page.indexOf('{isOpen && i === 2 &&'));
  assert.equal((soap.match(/>\s*Manage templates\s*</g) ?? []).length, 1);
  const cert = page.slice(page.indexOf('{isOpen && i === 7 &&'), page.indexOf('{isOpen && i === 8 &&'));
  assert.equal((cert.match(/>\s*Manage\s*</g) ?? []).length, 1);
  assert.match(cert, /aria-label="Manage"/);
  assert.doesNotMatch(cert, /Manage templates/);
});

test('C4 Saved note only after a real payload change; no green Saved at banner', () => {
  assert.doesNotMatch(page, /Saved at \$\{draftSavedAt\}/);
  assert.doesNotMatch(page, /message=\{`Saved at/);
  assert.match(page, /lastSavedPayloadRef/);
  assert.match(page, /data-testid="consult-inline-saved"/);
  assert.match(page, />Saved</);
  assert.match(page, /snapshotBeingSaved === previousPayload/);
  assert.match(page, /setInlineSaved\(true\)/);
});

test('C5 Review section / Review notes buttons are gone (save stays on footer / Ctrl+S)', () => {
  assert.doesNotMatch(page, />\s*Review section\s*</);
  assert.doesNotMatch(page, />\s*Review notes\s*</);
  assert.doesNotMatch(page, /setReviewSection/);
  assert.match(page, /Save draft/);
  assert.match(page, /Save amendment/);
});

test('C6 Vaccinations and Professional Fee sit behind More; tab bar wraps with no overflow-x', () => {
  assert.match(page, /OCCASIONAL_SECTIONS = \[5, 8\]/);
  assert.match(page, /\{showOccasional \? "Less" : "More"\}/);
  assert.match(nav, /flex-wrap/);
  assert.doesNotMatch(nav, /overflow-x-auto/);
  assert.match(nav, /cursor-pointer/);
  assert.match(nav, /border-outline-variant/);
  assert.match(page, /parseConsultSectionParam/);
  assert.match(page, /#section-\(\\d\+\)/);
  assert.match(page, /goToSection/);
  assert.match(page, /OCCASIONAL_SECTIONS\.includes\(i/);
});
//JJQR - END
