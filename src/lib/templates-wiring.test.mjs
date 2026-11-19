//JJQR - AI (Nov 19, 2026) - source-level wiring checks for the templates workspace (Phase 2 UI)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('workspace wiring: route keeps the h1 + e2e selectors, panel is guarded, deletes are undoable', () => {
  const page = read('app/doctor/templates/page.tsx');
  assert.match(page, /<h1[^>]*>Consultation templates<\/h1>/);
  assert.match(page, /TemplatesWorkspace/);
  const ws = read('components/doctor/templates/TemplatesWorkspace.tsx');
  assert.match(ws, /"Search this tab…"/);
  assert.match(ws, /const label = `\$\{TAB_LABELS\[id\]\} \(\$\{counts\[id\]\}\)`/);
  const panel = read('components/ui/SidePanel.tsx');
  assert.match(panel, /e\.key === "Escape"/);
  assert.match(panel, /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === "s"/);
  assert.match(panel, /Discard unsaved changes\?/);
  const undo = read('components/doctor/templates/useUndoableDelete.ts');
  assert.match(undo, /UNDO_MS = 5000/);
  const soap = read('components/doctor/templates/SoapTab.tsx');
  assert.match(soap, /SPECIALTY_CHIP_LABELS/); // specialty chips come from SPECIALTY_CHIP_LABELS
});

test('consultation2 + Rx form use the new template data (ICD code on Dx, full Rx-pad fields on Rx sets)', () => {
  const c2 = read('app/doctor/consultation2/[bookingId]/page.tsx');
  assert.match(c2, /addDiagnosisLine\(t\.body, t\.icd10_code \?\? null\)/);
  assert.match(c2, /createDiagnosisTemplate\(null as never, \{ label, body, icd10_code: newDiagnosisIcd \}\)/);
  const rx = read('components/doctor/PrescriptionForm.tsx');
  assert.match(rx, /function lineItemToTemplatePayload/);
  for (const f of ['route', 'meal_relation', 'timing', 'duration_kind', 'duration_value', 'indication']) {
    assert.match(rx, new RegExp(`${f}: i\\.`), `${f} must be mapped when saving a template`);
  }
  // every save path (Add to Template + modal save) goes through the one mapper
  assert.equal((rx.match(/lineItemToTemplatePayload/g) ?? []).length, 3);
  assert.match(rx, /mealRelation: i\.meal_relation === "Before"/);
});
//JJQR - END
