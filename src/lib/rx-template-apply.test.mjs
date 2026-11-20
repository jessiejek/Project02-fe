//JJQR - AI (Nov 19, 2026) - unit tests: Rx template -> prescription items mapping + the allergy-gate message
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load(p) {
  const container = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: container, exports: container.exports });
  return container.exports;
}
const plain = (x) => JSON.parse(JSON.stringify(x)); // results come from a vm realm: compare as plain data
const { planTemplateApply, describeTemplateApply } = load('lib/clinical/rx-template-apply.ts');

const item = (genericName, extra = {}) => ({ id: 'tpl-' + genericName, rxId: 'm-' + genericName, genericName, dosage: '500 mg', quantity: '21', instruction: 'with water', ...extra });
let n = 0;
const base = { allergyConflict: () => null, safety: () => [], newId: () => `new-${++n}` };

test('template -> Rx: every medicine is added with every field, fresh ids, route defaults to PO', () => {
  const full = item('Amoxicillin', { route: 'IV', mealRelation: 'After', timing: 'Breakfast,Dinner', durationKind: 'Days', durationValue: 7, indication: 'UTI', isControlledSubstance: false });
  const plan = planTemplateApply([full, item('Paracetamol')], [], base);
  assert.equal(plan.toAdd.length, 2);
  assert.deepEqual({ ...plain(plan.toAdd[0]), id: undefined }, { ...full, id: undefined });
  assert.notEqual(plan.toAdd[0].id, full.id);
  assert.equal(plan.toAdd[1].route, 'PO');
  assert.equal(plan.skipped.length, 0);
});

test('template -> Rx: duplicates are skipped (against the list and inside the template), case-insensitively', () => {
  const plan = planTemplateApply([item('PARACETAMOL'), item('Ibuprofen'), item('ibuprofen')], ['paracetamol'], base);
  assert.deepEqual(plain(plan.toAdd.map((i) => i.genericName)), ['Ibuprofen']);
  assert.deepEqual(plain(plan.skipped.map((s) => s.reason)), ['duplicate', 'duplicate']);
});

test('template -> Rx: allergy conflicts and drug-safety blocks are skipped and explained, warnings kept', () => {
  const plan = planTemplateApply([item('Amoxicillin'), item('Warfarin'), item('Aspirin')], [], {
    ...base,
    allergyConflict: (g) => (g === 'Amoxicillin' ? 'Penicillin' : null),
    safety: (g) => (g === 'Warfarin' ? [{ level: 'block', message: 'No warfarin in pregnancy' }] : g === 'Aspirin' ? [{ level: 'warn', message: 'Aspirin: caution' }] : []),
  });
  assert.deepEqual(plain(plan.toAdd.map((i) => i.genericName)), ['Aspirin']);
  assert.deepEqual(plain(plan.skipped.map((s) => [s.genericName, s.reason])), [['Amoxicillin', 'allergy'], ['Warfarin', 'safety']]);
  assert.equal(plan.skipped[0].message, 'Allergy conflict: Amoxicillin ↔ Penicillin');
  assert.deepEqual(plain(plan.warnings), ['Aspirin: caution']);
});

test('message: "Added N medicines from <name>" on success, singular for one', () => {
  const plan3 = planTemplateApply([item('A'), item('B'), item('C')], [], base);
  assert.deepEqual(plain(describeTemplateApply('Fever work-up', 3, plan3)), { variant: 'success', message: 'Added 3 medicines from Fever work-up' });
  const plan1 = planTemplateApply([item('A')], [], base);
  assert.equal(describeTemplateApply('X', 1, plan1).message, 'Added 1 medicine from X');
});

test('message: partial add warns, all-duplicates and blocked add never stay silent, empty template says so', () => {
  const part = describeTemplateApply('T', 2, planTemplateApply([item('A'), item('B')], ['a'], base));
  assert.equal(part.variant, 'warning');
  assert.match(part.message, /^Added 1 medicine from T; skipped 1 \(A: already on the list\)/);
  const dup = describeTemplateApply('T', 2, planTemplateApply([item('A'), item('B')], ['a', 'b'], base));
  assert.equal(dup.message, 'Nothing added: all 2 medicines from T are already on the list.');
  const allergy = describeTemplateApply('T', 1, planTemplateApply([item('A')], [], { ...base, allergyConflict: () => 'Sulfa' }));
  assert.equal(allergy.variant, 'error');
  assert.match(allergy.message, /Nothing added from T\. Allergy conflict: A ↔ Sulfa/);
  assert.match(describeTemplateApply('Empty', 0, planTemplateApply([], [], base)).message, /has no medicines/);
});

//JJQR Nov 20, 2026
test('wiring: no blocking allergy acknowledge gate; Templates tab still applies inline', () => {
  const formSrc = read('components/doctor/PrescriptionForm.tsx');
  const pageSrc = read('app/doctor/consultation2/[bookingId]/page.tsx');
  const gateSrc = read('lib/clinical/rx-template-apply.ts');
  assert.equal(formSrc.includes('isAllergyGateClosed'), false);
  assert.equal(formSrc.includes('Acknowledge'), false);
  assert.equal(pageSrc.includes('rx-allergy-review-banner'), false);
  assert.equal(gateSrc.includes('isAllergyGateClosed'), false);
  assert.match(formSrc, /data-testid="rx-template-notice"/);
  assert.match(formSrc, /planTemplateApply\(template\.items/);
});
//JJQR - END
test('wiring: every Rx row can be edited, System edits become your own copy, modal is wide', () => {
  const src = read('components/doctor/PrescriptionForm.tsx');
  assert.match(src, /isSystemCopy/);
  assert.match(src, /Editing your own copy of a System template/);
  assert.match(src, /size="xl"/);
  assert.match(src, /min-\[900px\]:grid-cols-/);
  assert.ok(!/\{!t\.isSystemTemplate && \(\s*<div className="flex items-center gap-sm">/.test(src), 'edit/delete must not be Mine-only any more');
  assert.match(read('components/ui/Modal.tsx'), /xl: "max-w-\[60rem\]"/);
  const rx = read('components/doctor/templates/RxTab.tsx');
  assert.match(rx, /duplicate\(t, \{ editing: true \}\)/);
});
//JJQR - END
