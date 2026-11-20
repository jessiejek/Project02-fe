//JJQR Nov 20, 2026 - template editor is a centered modal; Diagnoses tab hidden with the consult Diagnosis step
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('SidePanel renders as a centered modal (not a right drawer)', () => {
  const panel = read('components/ui/SidePanel.tsx');
  assert.match(panel, /fixed inset-0 z-40 flex items-center justify-center/);
  assert.doesNotMatch(panel, /flex justify-end">/);
  assert.match(panel, /max-w-2xl/);
  assert.match(panel, /max-h-\[90vh\]/);
  assert.match(panel, /rounded-xl/);
  assert.match(panel, /overflow-y-auto/);
  assert.match(panel, /sticky top-0/);
  assert.match(panel, /sticky bottom-0/);
  assert.doesNotMatch(panel, /lg:w-\[540px\]/);
});

test('all six template tabs use the shared SidePanel editor', () => {
  for (const f of ['SoapTab', 'PhrasesTab', 'RxTab', 'FavoritesTab', 'DiagnosesTab', 'CertsTab']) {
    assert.match(read(`components/doctor/templates/${f}.tsx`), /<SidePanel/, f);
  }
});

test('Diagnoses tab hidden, same as the consultation Diagnosis step', () => {
  assert.match(read('lib/templates/urlState.ts'), /export const SHOW_DIAGNOSES_TAB = false;/);
  assert.match(read('app/doctor/consultation2/[bookingId]/page.tsx'), /const SHOW_DIAGNOSIS_STEP = false;/);
  const ws = read('components/doctor/templates/TemplatesWorkspace.tsx');
  assert.match(ws, /VISIBLE_TEMPLATE_TABS\.map\(\(id\)/);
  assert.doesNotMatch(ws, /\{TEMPLATE_TABS\.map/);
});
//JJQR - END
