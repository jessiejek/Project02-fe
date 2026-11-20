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
  cleanMedCertAddress,
} = load('lib/clinical/med-cert-fields.ts');
const printForms = read('lib/print-forms.ts');

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

test('E3 patient address is a clean field; print builds a single residing-at sentence', () => {
  assert.match(cert, />Patient address</);
  assert.doesNotMatch(cert, /residing at/);
  assert.match(printForms, /cleanMedCertAddress/);
  assert.match(printForms, /residing at <span class="fill">\$\{e\(addr\)\}<\/span>/);
  assert.equal(cleanMedCertAddress('residing at 3ML Highway, '), '3ML Highway');
  assert.equal(cleanMedCertAddress('residing at residing at Cebu City,'), 'Cebu City');
  assert.equal(cleanMedCertAddress('  123 Main St,  '), '123 Main St');
  assert.equal(cleanMedCertAddress(''), '');
});
//JJQR - END
