//JJQR - AI (Nov 19, 2026) - unit tests for soap-merge, insert-text, template-links + consultation2 template wiring
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function load(p) {
  const container = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: container, exports: container.exports, URLSearchParams });
  return container.exports;
}
const { mergeSoapTemplate, mergeSoapField, hasSoapContent, soapEqual, emptySoap, SOAP_KEYS } = load('lib/clinical/soap-merge.ts');
const { insertAtCaret } = load('lib/clinical/insert-text.ts');
const { manageTemplatesHref } = load('lib/clinical/template-links.ts');
const soap = (o = {}) => ({ ...emptySoap(), ...o });

test('soap-merge: the five SOAP keys are exactly CC, S, O, A, P', () => {
  assert.deepEqual([...SOAP_KEYS], ['chiefComplaint', 'subjective', 'objective', 'assessment', 'plan']);
});
test('soap-merge: blank template fields never wipe existing text (replace and append)', () => {
  const cur = soap({ chiefComplaint: 'Cough x3d', assessment: 'URTI' });
  for (const mode of ['replace', 'append']) {
    const { values, outcomes } = mergeSoapTemplate(cur, { chiefComplaint: '', subjective: null, objective: undefined, assessment: '   ', plan: 'Rest' }, mode);
    assert.equal(values.chiefComplaint, 'Cough x3d');
    assert.equal(values.assessment, 'URTI');
    assert.equal(values.plan, 'Rest');
    assert.equal(outcomes.chiefComplaint, 'kept-template-blank');
    assert.equal(outcomes.plan, 'filled');
  }
});
test('soap-merge: replace swaps filled fields; append adds on a new line', () => {
  const cur = soap({ subjective: 'Fever' });
  assert.equal(mergeSoapField('Fever', 'Sore throat', 'replace').value, 'Sore throat');
  assert.equal(mergeSoapField('Fever', 'Sore throat', 'replace').outcome, 'replaced');
  assert.equal(mergeSoapField('Fever  \n', 'Sore throat', 'append').value, 'Fever\nSore throat');
  assert.equal(mergeSoapField('Fever', 'Sore throat', 'append').outcome, 'appended');
  assert.equal(mergeSoapTemplate(cur, { subjective: 'Sore throat' }, 'append').values.subjective, 'Fever\nSore throat');
});
test('soap-merge: empty notes are filled; appending the same text twice does not duplicate', () => {
  assert.equal(mergeSoapField('', 'Normal exam', 'append').value, 'Normal exam');
  assert.equal(mergeSoapField('  ', 'Normal exam', 'replace').outcome, 'filled');
  assert.equal(mergeSoapField('Normal exam', 'Normal exam', 'append').outcome, 'unchanged');
  assert.equal(mergeSoapField('Normal exam', 'Normal exam', 'replace').outcome, 'unchanged');
});
test('soap-merge: undo helpers', () => {
  const a = soap({ plan: 'x' });
  assert.equal(hasSoapContent(soap()), false);
  assert.equal(hasSoapContent(a), true);
  assert.equal(soapEqual(a, { ...a }), true);
  assert.equal(soapEqual(a, soap({ plan: 'y' })), false);
  // applying an all-blank template changes nothing
  assert.equal(soapEqual(mergeSoapTemplate(a, soap(), 'replace').values, a), true);
});

test('insert-text: inserts at the caret on its own line', () => {
  const r = insertAtCaret('Fever for 3 days. Cough.', 'No chest pain', 18, 18);
  assert.equal(r.value, 'Fever for 3 days. \nNo chest pain\nCough.');
  assert.equal(r.caret, 'Fever for 3 days. \nNo chest pain'.length);
});
test('insert-text: empty value, end of text, and existing newlines add no blank lines', () => {
  assert.equal(insertAtCaret('', 'Hello', 0, 0).value, 'Hello');
  assert.equal(insertAtCaret('A', 'B', 1, 1).value, 'A\nB');
  assert.equal(insertAtCaret('A\n', 'B', 2, 2).value, 'A\nB');
  assert.equal(insertAtCaret('A\nC', 'B', 2, 2).value, 'A\nB\nC');
  assert.equal(insertAtCaret('A\nC', 'B', 1, 1).value, 'A\nB\nC');
});
test('insert-text: unknown or out-of-range caret falls back to the end; selection is never deleted', () => {
  assert.equal(insertAtCaret('Note', 'Phrase').value, 'Note\nPhrase');
  assert.equal(insertAtCaret('Note', 'Phrase', null, null).value, 'Note\nPhrase');
  assert.equal(insertAtCaret('Note', 'Phrase', 99, 99).value, 'Note\nPhrase');
  assert.equal(insertAtCaret('Note', 'Phrase', -1, -1).value, 'Note\nPhrase');
  const sel = insertAtCaret('abcdef', 'X', 1, 3); // selection b-c kept, phrase goes after it
  assert.ok(sel.value.includes('abcdef'.slice(0, 3)) && sel.value.endsWith('def'));
  assert.equal(insertAtCaret('keep', '   ', 0, 0).value, 'keep');
});
test('template-links: deep links', () => {
  assert.equal(manageTemplatesHref('soap'), '/doctor/templates?tab=soap');
  assert.equal(manageTemplatesHref('phrases', 'chiefComplaint'), '/doctor/templates?tab=phrases&field=chiefComplaint');
});

test('consultation2 template wiring (Phase 1): modal, undo, guards, manage links, shared loader', () => {
  const page = read('app/doctor/consultation2/[bookingId]/page.tsx');
  const tb = read('components/doctor/SoapFieldToolbar.tsx');
  assert.match(page, /aria-label="Use SOAP template"/);
  assert.match(page, /<option value="">Use Template…<\/option>/);
  assert.match(page, /Apply SOAP template/);
  //JJQR - AI (Nov 19, 2026) - empty notes: apply directly (no modal) but keep the Undo snapshot; text present: preview modal
  const fn = page.slice(page.indexOf('function applyTemplate(template: SoapTemplate)'), page.indexOf('async function saveAsTemplate()'));
  assert.match(fn, /if \(!hasSoapContent\(currentSoap\)\) \{/);
  assert.match(fn, /doApplyTemplate\(template, "replace"\)/);
  assert.match(fn, /setPendingTemplate\(template\)/);
  assert.ok(fn.indexOf('doApplyTemplate(template, "replace")') < fn.indexOf('setPendingTemplate(template)'));
  const apply = page.slice(page.indexOf('function doApplyTemplate('), page.indexOf('function undoTemplateApply()'));
  assert.match(apply, /setTemplateUndo\(/);
  //JJQR - END
  assert.match(page, /Append \(keep my text\)/);
  assert.match(page, /actionLabel="Undo"/);
  assert.match(page, /Nothing to save — all five SOAP fields are empty/);
  assert.match(page, /Replace certificate text\?/);
  assert.match(page, /SOAP templates couldn&apos;t load/);
  assert.match(page, /manageTemplatesHref\("soap"\)/);
  assert.match(page, /manageTemplatesHref\("diagnoses"\)/);
  assert.match(page, /manageTemplatesHref\("certificates"\)/);
  assert.doesNotMatch(page, /querySoapTemplates\(/);
  assert.match(tb, /manageTemplatesHref\("phrases", field\)/);
  assert.match(tb, /insertAtCaret/);
  assert.match(tb, /useSoapPhrases/);
  assert.doesNotMatch(tb, /querySoapPhrases/);
});
test('template library: one in-flight phrase request is shared and each list fails independently', () => {
  const lib = read('lib/clinical/useTemplateLibrary.ts');
  assert.match(lib, /phraseInflight/);
  assert.match(lib, /if \(existing\) return existing/);
  assert.match(lib, /useLoadedList<SoapTemplateRow>/);
  assert.match(lib, /useLoadedList<MedicalCertificateTemplateRow>/);
  assert.match(lib, /useLoadedList<DiagnosisTemplateRow>/);
});
//JJQR - END
