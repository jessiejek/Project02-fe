//JJQR - AI (Nov 19, 2026) - unit tests for consultation2 UI/UX helpers (step circles, jump to missing, green preview highlight, NKDA action)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load(p) {
  const container = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: container, exports: container.exports, require: () => ({}) });
  return container.exports;
}
const steps = load('lib/clinical/consult-steps.ts');
const { splitAddedText } = load('lib/clinical/soap-merge.ts');

test('step circles: unvisited required step is an empty circle until the doctor tries to complete', () => {
  const base = { satisfied: false, required: true, hasDraft: false };
  assert.equal(steps.stepIndicator({ ...base, attemptedComplete: false }), 'empty');
  assert.equal(steps.stepIndicator({ ...base, attemptedComplete: true }), 'warning');
  assert.equal(steps.stepIndicator({ ...base, satisfied: true, attemptedComplete: false }), 'complete');
  assert.equal(steps.stepIndicator({ satisfied: false, required: false, hasDraft: true, attemptedComplete: false }), 'partial');
  assert.equal(steps.stepIndicator({ satisfied: false, required: false, hasDraft: false, attemptedComplete: true }), 'empty');
});

test('jump to next missing required section (wraps, null when none)', () => {
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(steps.nextMissingSection([], 0, order), null);
  assert.equal(steps.nextMissingSection([2, 6], 0, order), 2);
  assert.equal(steps.nextMissingSection([2, 6], 2, order), 6);
  assert.equal(steps.nextMissingSection([2, 6], 6, order), 2);
  assert.equal(steps.nextMissingSection([3], 3, order), 3);
});

test('apply preview: appended text is split so only the new part is green', () => {
  assert.deepEqual({ ...splitAddedText('cough', 'cough\nfever', 'appended') }, { kept: 'cough', added: '\nfever' });
  assert.deepEqual({ ...splitAddedText('', 'fever', 'filled') }, { kept: '', added: 'fever' });
  assert.deepEqual({ ...splitAddedText('old', 'new', 'replaced') }, { kept: '', added: 'new' });
  assert.deepEqual({ ...splitAddedText('keep', 'keep', 'kept-template-blank') }, { kept: 'keep', added: '' });
  assert.deepEqual({ ...splitAddedText('same', 'same', 'unchanged') }, { kept: 'same', added: '' });
});

test('consultation2 UI/UX wiring: visible Use template bar, More toggle, jump button, NKDA action, green mark', () => {
  const page = read('app/doctor/consultation2/[bookingId]/page.tsx');
  const banner = read('components/doctor/ConsultPatientBanner.tsx');
  assert.ok(page.indexOf('aria-label="Use SOAP template"') < page.indexOf('Previous note and specialty filter'));
  assert.doesNotMatch(page, /Templates and previous notes/);
  //JJQR - AI (Nov 20, 2026) C6 - More toggle present; tab bar wraps; no overflow-x on the section nav
  assert.match(page, /\{showOccasional \? "Less" : "More"\}/);
  assert.match(page, /flex flex-wrap gap-sm/);
  const nav = page.slice(page.indexOf('aria-label="Consultation sections"'), page.indexOf('min-w-0 space-y-md pb-[max(16rem'));
  assert.doesNotMatch(nav, /overflow-x-auto/);
  assert.match(nav, /cursor-pointer/);
  //JJQR - END
  assert.match(page, /nextMissingSection\(missingRequiredSections/);
  assert.match(page, /data-added="true"/);
  assert.match(banner, /Record allergies \/ NKDA/);
  assert.match(banner, /setAllergyEditorOpen\(true\)/);
});
