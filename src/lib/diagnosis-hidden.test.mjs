import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('app/doctor/consultation2/[bookingId]/page.tsx');

test('SHOW_DIAGNOSIS_STEP flag hides Diagnosis from nav and gates', () => {
  assert.match(page, /const SHOW_DIAGNOSIS_STEP = false;/);
  assert.match(page, /const DIAGNOSIS_SECTION_INDEX = 2;/);
});

test('Diagnosis is excluded from required gating when SHOW_DIAGNOSIS_STEP is false', () => {
  assert.match(
    page,
    /const effectiveRequiredSections = REQUIRED_SECTIONS\.filter\(\s*\n?\s*\(i\) => SHOW_DIAGNOSIS_STEP \|\| i !== DIAGNOSIS_SECTION_INDEX,/,
  );
  assert.match(page, /const canComplete = effectiveRequiredSections\.every\(\(i\) => isRequiredSectionDone\(i\)\);/);
  assert.match(page, /effectiveRequiredSections\.filter\(\(i\) => !isRequiredSectionDone\(i\)\)/);
  assert.match(page, /effectiveRequiredSections\.includes\(i\)/);
  assert.doesNotMatch(page, /sectionSatisfied\[2\] &&\s*\n\s*rxSatisfied/);
});

test('visible section order and UI surfaces omit hidden Diagnosis', () => {
  assert.match(page, /!SHOW_DIAGNOSIS_STEP && i === DIAGNOSIS_SECTION_INDEX\) return false/);
  assert.match(page, /visibleSectionOrder\.map\(\(i\) => \(\s*\n?\s*<li key=\{SECTIONS\[i\]\}/);
  assert.match(page, /nextMissingSection\(missingRequiredSections, openSection, visibleSectionOrder\)/);
});