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
//JJQR - END
