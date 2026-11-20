//JJQR - AI (Nov 19, 2026) - unit tests for the templates workspace pure helpers (deep links, validation, search, reorder)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load(p, extra = {}) {
  const container = { exports: {} };
  const requireStub = (name) => { if (name in extra) return extra[name]; throw new Error('unexpected import ' + name); };
  vm.runInNewContext(ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: container, exports: container.exports, require: requireStub, URLSearchParams });
  return container.exports;
}
const url = load('lib/templates/urlState.ts');
const val = load('lib/templates/validation.ts');
const { moveId } = load('lib/templates/reorder.ts');
const search = load('lib/templates/search.ts');

test('urlState: tabs, aliases and the Phase 1 consultation2 deep links', () => {
  assert.deepEqual([...url.TEMPLATE_TABS], ['soap', 'phrases', 'rx', 'favorites', 'diagnoses', 'certificates']);
  assert.equal(url.parseTab('phrases'), 'phrases');
  assert.equal(url.parseTab('PRESCRIPTIONS'), 'rx');
  assert.equal(url.parseTab('med-certs'), 'certificates');
  assert.equal(url.parseTab('nope'), 'soap');
  assert.equal(url.parseTab(null), 'soap');
  //JJQR Nov 20, 2026 - Diagnoses tab hidden
  assert.equal(url.SHOW_DIAGNOSES_TAB, false);
  assert.deepEqual([...url.VISIBLE_TEMPLATE_TABS], ['soap', 'phrases', 'rx', 'favorites', 'certificates']);
  assert.equal(url.parseTab('diagnoses'), 'soap');
  assert.equal(url.parseTab('diagnosis'), 'soap');
  //JJQR - END
  assert.equal(url.parseField('chiefComplaint'), 'ChiefComplaint');
  assert.equal(url.parseField('plan'), 'Plan');
  assert.equal(url.parseField('Chief_Complaint'), 'ChiefComplaint');
  assert.equal(url.parseField('bogus'), null);
  assert.equal(url.buildTemplatesUrl({ tab: 'phrases', field: 'Plan' }), '/doctor/templates?tab=phrases&field=Plan');
  assert.equal(url.buildTemplatesUrl({ tab: 'soap', id: 'abc' }), '/doctor/templates?tab=soap&id=abc');
  // every field the consultation toolbar can link with is understood
  for (const f of ['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan']) assert.ok(url.parseField(f), f);
});

test('validation: empty saves are blocked with a reason', () => {
  assert.match(val.validateSoapTemplate({ title: '', fields: ['a'] }), /name/);
  assert.match(val.validateSoapTemplate({ title: 'T', fields: ['', ' ', null, undefined, ''] }), /at least one SOAP field/);
  assert.equal(val.validateSoapTemplate({ title: 'T', fields: ['', 'x'] }), null);
  assert.match(val.validatePhrase({ label: '', body: 'x' }), /name/);
  assert.match(val.validatePhrase({ label: 'x', body: '  ' }), /text/);
  assert.equal(val.validatePhrase({ label: 'x', body: 'y' }), null);
  assert.match(val.validatePhrase({ label: 'x'.repeat(201), body: 'y' }), /too long/);
  assert.match(val.validateRxTemplate({ title: 'T', items: [{ genericName: ' ' }] }), /at least one medicine/);
  assert.equal(val.validateRxTemplate({ title: 'T', items: [{ genericName: 'Paracetamol' }] }), null);
  assert.match(val.validateFavorite({ genericName: '' }), /medicine/);
  assert.match(val.validateDiagnosis({ label: 'URTI', body: '' }), /text/);
  assert.match(val.validateCertTemplate({ title: 'T', fields: ['', ''] }), /at least one certificate field/);
  assert.equal(val.validateCertTemplate({ title: 'T', fields: ['', 'x'] }), null);
});

test('reorder: move up/down, boundaries and unknown ids are no-ops', () => {
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c']);
  assert.deepEqual(moveId(['a', 'b'], 'zzz', 1), ['a', 'b']);
});

const lib = {
  soap: [{ id: 's1', title: 'Adult URTI', chief_complaint: 'Cough and colds' }, { id: 's2', title: 'Prenatal visit', plan: 'Return in 4 weeks' }],
  phrases: [{ id: 'p1', field: 'Plan', label: 'Rest', body: 'Rest and fluids' }],
  rx: [{ template_id: 'r1', title: 'Fever kit', prescription_template_items: [{ generic_name: 'Paracetamol', dosage: '500mg' }] }],
  favorites: [{ id: 'f1', generic_name: 'Amoxicillin', dosage: '500mg' }],
  diagnoses: [{ id: 'd1', label: 'URTI', body: 'Acute upper respiratory infection', icd10_code: 'J06.9' }],
  certificates: [{ id: 'c1', title: 'Fit to work', diagnosis_text: 'Fit', recommendations: 'May resume work' }],
};
test('search: global search spans every tab (title, body, medicine, ICD-10) and ANDs the terms', () => {
  const hit = (q) => search.searchAll(q, lib);
  assert.equal(hit('').soap.length + hit('   ').rx.length, 0);
  assert.deepEqual(hit('urti').soap.map((h) => h.id), ['s1']);
  assert.deepEqual(hit('urti').diagnoses.map((h) => h.id), ['d1']);
  assert.deepEqual(hit('j06').diagnoses.map((h) => h.id), ['d1']);
  assert.deepEqual(hit('paracetamol').rx.map((h) => h.id), ['r1']);
  assert.deepEqual(hit('500mg').favorites.map((h) => h.id), ['f1']);
  assert.deepEqual(hit('rest fluids').phrases.map((h) => h.id), ['p1']);
  assert.equal(hit('rest fluids').phrases[0].field, 'Plan');
  assert.deepEqual(hit('resume').certificates.map((h) => h.id), ['c1']);
  assert.equal(search.totalHits(hit('zzzz')), 0);
  assert.equal(search.matchesQuery('', 'anything'), true);
  assert.equal(search.matchesQuery('cough xyz', 'cough and colds'), false);
});

//JJQR - END
