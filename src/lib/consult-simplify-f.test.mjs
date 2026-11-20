//JJQR - AI (Nov 20, 2026) F1–F4 — static source assertions for professional fee
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const page = read('app/doctor/consultation2/[bookingId]/page.tsx');
const justStart = page.indexOf('if (justCompleted) {');
const viewStart = page.indexOf('if (mode === "view") {', justStart);
const amendStart = page.indexOf('mode === "complete" | "amend"', viewStart);
const just = page.slice(justStart, viewStart);
const view = page.slice(viewStart, amendStart);

test('F1 completed view is a read-only Professional fee line; Edit opens section 9; post-complete save path is gone', () => {
  assert.doesNotMatch(page, /handleSavePostCompletePf/);
  assert.doesNotMatch(page, /savingPostCompletePf/);
  assert.doesNotMatch(page, /Save fee decision/);
  assert.match(page, /function formatProfessionalFeeLine/);
  assert.match(page, /function openProfessionalFeeForEdit/);
  assert.match(page, /goToSection\(8\)/);
  assert.match(page, /Professional fee: Charge \$\{formatPeso\(n\)\}/);
  assert.match(page, /Professional fee: Waive —/);
  assert.match(page, /Professional fee: Decide at desk/);
  assert.match(just, /formatProfessionalFeeLine/);
  assert.match(just, />\s*Edit\s*</);
  assert.match(just, /openProfessionalFeeForEdit/);
  assert.doesNotMatch(just, /placeholder="Amount\*"/);
  assert.doesNotMatch(just, /Save fee decision/);
  assert.match(view, /formatProfessionalFeeLine/);
  assert.match(view, /openProfessionalFeeForEdit/);
  assert.doesNotMatch(view, /Waived —/);
});
//JJQR - END
