//JJQR - AI (Nov 20, 2026) E1 — static source assertions for medical-certificate auto-fill
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
const cert = page.slice(page.indexOf('{isOpen && i === 7 &&'), page.indexOf('{isOpen && i === 8 &&'));
const {
  patientAddressFromProfile,
  examinedAtFromClinic,
  diagnosisTextFromConsult,
  shouldApplyTemplateDiagnosis,
} = load('lib/clinical/med-cert-fields.ts');

test('E1 auto-fills known medical-certificate fields; doctor only types recs / except / come-back', () => {
  assert.match(cert, /patientAgeYears != null \? `, \$\{patientAgeYears\}y`/);
  assert.match(cert, /License No\./);
  assert.match(cert, /PTR No\./);
  assert.match(cert, /doctorProfile\?\.license_number/);
  assert.match(cert, /No address on file/);
  assert.match(cert, />Examined at</);
  assert.match(page, /examinedAtFromClinic\(s\.clinic_name, s\.address\)/);
  assert.match(page, /useState\(\(\) => todayManila\(\)\)/);
  assert.match(page, /diagnosisTextFromConsult/);
  assert.match(page, /updatePatient\(supabase, booking\.patientId, \{ address: typedAddress \}\)/);
  assert.match(page, /patientAddressFromProfile\(patientRow\?\.address, patientRow\?\.city\)/);
  assert.doesNotMatch(page, /doctorClinicLabel/);
  assert.equal(patientAddressFromProfile('3ML Highway', 'Lapu-Lapu City'), '3ML Highway, Lapu-Lapu City');
  assert.equal(patientAddressFromProfile('', 'Cebu'), 'Cebu');
  assert.equal(patientAddressFromProfile(null, null), '');
  assert.equal(examinedAtFromClinic('Grace Medical Clinic', '3ML Quezon National Highway, Buaya, Lapu-Lapu City'), 'Grace Medical Clinic, 3ML Quezon National Highway, Buaya, Lapu-Lapu City');
  assert.equal(diagnosisTextFromConsult(['Asthma', 'URI'], 'fallback'), 'Asthma; URI');
  assert.equal(diagnosisTextFromConsult([], '  Assessment only  '), 'Assessment only');
  assert.equal(diagnosisTextFromConsult([], ''), '');
});

test('E2 applying a certificate template only fills recs / except / come-back, never diagnosis when consult dx exists', () => {
  assert.match(page, /shouldApplyTemplateDiagnosis/);
  assert.match(page, /applyDx\s*\?\s*\[\s*\{\s*label: "Diagnosis \/ Impressions"/);
  assert.doesNotMatch(page, /setMcExaminedAt\(template/);
  assert.doesNotMatch(page, /setMcAddress\(template/);
  assert.doesNotMatch(page, /setMcExamFrom\(template/);
  assert.doesNotMatch(page, /setMcExamTo\(template/);
  assert.equal(shouldApplyTemplateDiagnosis(['Asthma'], ''), false);
  assert.equal(shouldApplyTemplateDiagnosis([], 'Assessment'), false);
  assert.equal(shouldApplyTemplateDiagnosis([], ''), true);
});
//JJQR - END
