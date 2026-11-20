//JJQR Nov 20, 2026
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../app/doctor/consultation2/[bookingId]/page.tsx', import.meta.url), 'utf8');

test('"required sections left" banner is hidden by a false flag, code kept', () => {
  assert.match(src, /const SHOW_REQUIRED_LEFT_BANNER = false;/);
  assert.match(src, /SHOW_REQUIRED_LEFT_BANNER && !canComplete && missingRequiredSections\.length > 0/);
  assert.match(src, /Go to the next one/); // markup is still in the source
});

test('completion gating and warning indicators are unchanged', () => {
  assert.match(src, /const missingRequiredSections = effectiveRequiredSections\.filter\(\(i\) => !isRequiredSectionDone\(i\)\);/);
  assert.match(src, /const canComplete = effectiveRequiredSections\.every\(\(i\) => isRequiredSectionDone\(i\)\);/);
  assert.match(src, /disabled=\{!canComplete \|\| savingDraft\} onClick=\{\(\) => \{ setCompleteAttempted\(true\); setChecklistOpen\(true\); \}\}/);
  assert.match(src, /stepIndicator\(/);
});

//JJQR Nov 20, 2026
test('tab warnings no longer depend on the hidden banner click', () => {
  assert.match(src, /const WARN_EMPTY_REQUIRED_ON_LOAD = true;/);
  assert.match(src, /const showRequiredWarnings = \(WARN_EMPTY_REQUIRED_ON_LOAD && mode !== "view"\) \|\| completeAttempted;/);
  assert.match(src, /attemptedComplete: showRequiredWarnings/);
  assert.match(src, /if \(showRequiredWarnings && effectiveRequiredSections\.includes\(i\)/);
  assert.doesNotMatch(src, /attemptedComplete: completeAttempted/);
  assert.doesNotMatch(src, /if \(completeAttempted && effectiveRequiredSections/);
  // setCompleteAttempted is no longer reachable only through the banner: Review & complete sets it too
  assert.match(src, /setCompleteAttempted\(true\); setChecklistOpen\(true\);/);
  // gating untouched
  assert.match(src, /const canComplete = effectiveRequiredSections\.every/);
});
