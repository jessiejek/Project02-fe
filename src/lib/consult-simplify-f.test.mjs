//JJQR - AI (Nov 20, 2026) F1–F5 — static source assertions for professional fee
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load(p, requireImpl = () => ({})) {
  const container = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: container, exports: container.exports, require: requireImpl },
  );
  return container.exports;
}
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

//JJQR - AI (Nov 21, 2026) - "Decide at desk" is no longer offered when documenting a visit (old stored ones still display it in the completed view)
test('F2 labels are Charge and Waive (no Charge PF / Waive PF, no Decide at desk button)', () => {
  assert.doesNotMatch(page, /Charge PF/);
  assert.doesNotMatch(page, /Waive PF/);
  assert.match(page, /setPfDecision\("charge"\)[\s\S]{0,800}Charge\s*<\/button>/);
  assert.match(page, /setPfDecision\("waive"\)[\s\S]{0,400}Waive\s*<\/button>/);
  assert.doesNotMatch(page, /Decide at desk\s*<\/button>/);
  const fullVisit = readFileSync(new URL('../../e2e/journeys/full-visit.spec.ts', import.meta.url), 'utf8');
  const matrix = readFileSync(new URL('../../e2e/journeys/consultation-regression-matrix.spec.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(fullVisit, /Charge PF|Waive PF/);
  assert.doesNotMatch(matrix, /Charge PF|Waive PF/);
});

test('F3 section 9 shows one Total line from computeClinicFee; Charge prefills empty Amount; total == sum', () => {
  assert.doesNotMatch(page, /Computed clinic fee:/);
  assert.match(page, /computeClinicFee\(feeSchedule, visitType, discountCategory, medCertRequested\)/);
  assert.match(page, /feePreview\.summary/);
  assert.match(page, /discountPct: s\.discount_pct/);
  //JJQR - AI (Nov 21, 2026) - the Amount FOLLOWS the computed total (never baked into editor state / saved as the doctor's amount)
  assert.doesNotMatch(page, /if \(!pfAmount\.trim\(\) && previewFee !== null\) setPfAmount\(String\(previewFee\)\)/);
  assert.match(page, /pfDecision === "charge" && !pfAmountEdited && previewFee !== null\s*\?\s*String\(previewFee\)/);
  const format = load('lib/format.ts');
  const { computeClinicFee, clinicFeePartsSum } = load('lib/clinical/preview-fee.ts', (id) => {
    if (String(id).includes('format')) return format;
    return {};
  });
  const schedule = { consultation: 450, followUp: 350, seniorPwd: 400, medCert: 50, discountPct: 0.2 };
  const followUpCert = computeClinicFee(schedule, 'FollowUp', '', true);
  assert.equal(followUpCert.total, 400);
  assert.equal(clinicFeePartsSum(followUpCert.parts), followUpCert.total);
  assert.equal(followUpCert.summary, 'Total: ₱400 (Follow-up ₱350 + Medical certificate ₱50)');
  const discounted = computeClinicFee(schedule, 'FollowUp', 'Senior', true);
  assert.equal(discounted.total, 450);
  assert.equal(clinicFeePartsSum(discounted.parts), discounted.total);
  assert.match(discounted.summary, /^Total: ₱450 \(Follow-up ₱350 \+ Medical certificate ₱50 − Senior discount /);
  const newVisit = computeClinicFee(schedule, 'New', '', false);
  assert.equal(newVisit.total, 450);
  assert.equal(clinicFeePartsSum(newVisit.parts), newVisit.total);
});

test('F4 stored PF decisions load as-is (no totalFee overwrite); Charge with null amount hints the clinic total', () => {
  assert.doesNotMatch(page, /setPfAmount\(String\(realBooking\.totalFee/);
  assert.doesNotMatch(page, /pf_amount \?\? 0/);
  assert.doesNotMatch(page, /feeDecision\?\.amount \?\? booking\?\.totalFee/);
  assert.match(page, /pfEditorAmountFromStored\(fd\)/);
  assert.match(page, /consultRes\.data\.pf_amount \?\? undefined/);
  assert.match(page, /pfAmountEdited && pfAmount\.trim\(\) !== "" \? Number\(pfAmount\) : undefined/); //JJQR - AI (Nov 21, 2026) - only a typed amount is the doctor's
  assert.match(page, /\(Total: \$\{formatPeso\(opts\.computedTotal\)\}\)/);
  assert.match(page, /computedTotal: previewFee/);
});

test('F5 Charge is the editor default when pf_decision is null; view still shows stored Decide at desk', () => {
  const formatMod = load('lib/format.ts');
  const {
    pfEditorDecisionFromStored,
    pfViewDecisionFromStored,
    pfEditorAmountFromStored,
    shouldPrefillChargeAmount,
    computeClinicFee,
  } = load('lib/clinical/preview-fee.ts', (id) => {
    if (String(id).includes('format')) return formatMod;
    return {};
  });
  assert.equal(pfEditorDecisionFromStored(undefined), 'charge');
  assert.equal(pfEditorDecisionFromStored(null), 'charge');
  assert.equal(pfEditorDecisionFromStored({ type: 'Charge', amount: 400 }), 'charge');
  assert.equal(pfEditorDecisionFromStored({ type: 'Waive', waiveReason: 'indigent' }), 'waive');
  assert.equal(pfViewDecisionFromStored(undefined), null);
  assert.equal(pfViewDecisionFromStored({ type: 'Charge', amount: 400 }), 'charge');
  assert.equal(pfViewDecisionFromStored({ type: 'Waive' }), 'waive');
  assert.equal(pfEditorAmountFromStored({ type: 'Charge', amount: 400 }), '400');
  assert.equal(pfEditorAmountFromStored({ type: 'Charge', amount: null }), '');
  assert.equal(pfEditorAmountFromStored({ type: 'Waive' }), '');
  assert.equal(shouldPrefillChargeAmount('charge', '', null), true);
  assert.equal(shouldPrefillChargeAmount('charge', '', 'Charge'), false);
  assert.equal(shouldPrefillChargeAmount('waive', '', null), false);
  const newVisit = computeClinicFee({ consultation: 450, followUp: 350, seniorPwd: 400, medCert: 50, discountPct: 0.2 }, 'New', '', false);
  assert.equal(newVisit.total, 450);
  assert.match(page, /useState<"charge" \| "waive" \| null>\("charge"\)/);
  assert.match(page, /pfEditorDecisionFromStored/);
  assert.match(page, /pfViewDecisionFromStored\(sc\.feeDecision\)/);
  assert.match(page, /const pfAmountShown/);
  assert.match(page, /const \[pfAmountEdited, setPfAmountEdited\]/); //JJQR - AI (Nov 21, 2026) - replaces the old prefill-then-bake helper
  assert.match(page, /value=\{pfAmountShown\}/);
  //JJQR - AI (Nov 21, 2026) - the auto-filled total is no longer baked into the editor; the just-completed line falls back to the amount actually charged (booking total)
  assert.doesNotMatch(page, /setPfAmount\(pfAmountShown\)/);
  assert.match(page, /savedSummaryAmount\(pfEditorAmountFromStored\(savedConsultation\?\.feeDecision\), pfAmountShown, booking\?\.totalFee\)/); //JJQR - AI (2026-11-25) - the amount charged, not the fee loaded at page open //JJQR - END
  assert.match(page, /Professional fee: Decide at desk/);
  const loadStart = page.indexOf('async function load()');
  const loadEnd = page.indexOf('if (cancelled) return;', loadStart);
  const loadBody = page.slice(loadStart, loadEnd);
  assert.doesNotMatch(loadBody, /persistConsultation/);
});
//JJQR - END
