//JJQR - AI (Nov 19, 2026) - unit tests for the templates page UI/UX helpers (Mine-first, copy naming, Rx sig, phrase name auto-fill, list view default)
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
const f = load('lib/templates/format.ts');

test('Mine-first sort: Mine before System, A-Z inside each group', () => {
  const rows = [
    { t: 'Zeta', sys: false }, { t: 'Alpha', sys: true }, { t: 'Beta', sys: false }, { t: 'Aardvark', sys: true },
  ];
  const out = f.sortMineFirst(rows, (r) => r.sys, (r) => r.t).map((r) => r.t);
  assert.deepEqual(out, ['Beta', 'Zeta', 'Aardvark', 'Alpha']);
});

test('copy naming is clearly different and never collides', () => {
  assert.equal(f.copyTitle('Fever', ['Fever']), 'Copy of Fever');
  assert.equal(f.copyTitle('Fever', ['Fever', 'Copy of Fever']), 'Copy of Fever (2)');
  assert.equal(f.copyTitle('Copy of Fever', ['Copy of Fever']), 'Copy of Fever (2)');
  assert.equal(f.isCopyTitle('Copy of X'), true);
  assert.equal(f.isCopyTitle('X'), false);
});

test('Rx sig is shown in normal case with dose, frequency and duration', () => {
  assert.equal(f.normalCase('AMOXICILLIN'), 'Amoxicillin');
  assert.equal(f.normalCase('Paracetamol 500 mg'), 'Paracetamol 500 mg');
  assert.equal(
    f.rxSig({ generic_name: 'AMOXICILLIN', dosage: '500 MG', instruction: 'Three times a day', meal_relation: 'After', duration_kind: 'Days', duration_value: 7 }),
    'Amoxicillin 500 mg — Three times a day, after meals · 7 days',
  );
  assert.equal(f.rxSig({ generic_name: 'METFORMIN', dosage: '500 mg', duration_kind: 'Maintain' }), 'Metformin 500 mg — maintenance');
  assert.equal(f.rxSig({ generic_name: 'Ibuprofen' }), 'Ibuprofen');
});

test('phrase name auto-fills from the first words of the text', () => {
  assert.equal(f.phraseNameFromText('normal cardiac exam, no murmurs heard on auscultation'), 'Normal cardiac exam, no murmurs');
  assert.equal(f.phraseNameFromText('  Afebrile.  '), 'Afebrile');
  assert.equal(f.phraseNameFromText(''), '');
  assert.ok(f.phraseNameFromText('supercalifragilisticexpialidocious '.repeat(4)).length <= 40);
});

test('templates page wiring: list view default, labelled filters, Move to menu, favorites how-to, tab nav wraps', () => {
  const ws = read('components/doctor/templates/TemplatesWorkspace.tsx');
  const shared = read('components/doctor/templates/shared.tsx');
  const phrases = read('components/doctor/templates/PhrasesTab.tsx');
  assert.match(ws, /useState<ViewMode>\("list"\)/);
  assert.match(shared, /createContext<ViewMode>\("list"\)/);
  assert.match(shared, /<FilterGroup|export function FilterGroup/);
  for (const tab of ['SoapTab', 'RxTab', 'CertsTab']) assert.match(read(`components/doctor/templates/${tab}.tsx`), /<FilterGroup label="Source">/);
  assert.match(read('components/doctor/templates/SoapTab.tsx'), /<FilterGroup label="Specialty">/);
  assert.match(read('components/doctor/templates/SoapTab.tsx'), /sortMineFirst\(rows/);
  assert.match(phrases, /Move to…/);
  assert.doesNotMatch(phrases, /Field: \$\{/);
  assert.match(phrases, /phraseNameFromText\(e\.target\.value\)/);
  assert.match(read('components/doctor/templates/FavoritesTab.tsx'), /data-testid="favorites-empty"/);
  assert.match(ws, /flex flex-wrap gap-x-xs border-b/);
});
