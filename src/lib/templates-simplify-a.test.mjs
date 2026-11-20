//JJQR - AI (Nov 20, 2026) A1 A3 A4 — static source checks for templates simplify
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const tabs = {
  soap: read('components/doctor/templates/SoapTab.tsx'),
  rx: read('components/doctor/templates/RxTab.tsx'),
  certs: read('components/doctor/templates/CertsTab.tsx'),
  diagnoses: read('components/doctor/templates/DiagnosesTab.tsx'),
  phrases: read('components/doctor/templates/PhrasesTab.tsx'),
  favorites: read('components/doctor/templates/FavoritesTab.tsx'),
};
const ws = read('components/doctor/templates/TemplatesWorkspace.tsx');
const shared = read('components/doctor/templates/shared.tsx');
const types = read('components/doctor/templates/types.ts');
const clinical = read('lib/data/clinical.ts');
const c2 = read('app/doctor/consultation2/[bookingId]/page.tsx');
const rxForm = read('components/doctor/PrescriptionForm.tsx');

test('A1 A3: templates page has no Source or Specialty filter and no Mine/System pills', () => {
  assert.doesNotMatch(ws, /setSpecialty/);
  assert.doesNotMatch(ws, /useState<Specialty/);
  assert.doesNotMatch(types, /specialty:/);
  for (const [name, src] of Object.entries(tabs)) {
    assert.doesNotMatch(src, /FilterGroup label="Source"/, name);
    assert.doesNotMatch(src, /FilterGroup label="Specialty"/, name);
    assert.doesNotMatch(src, /tone=\{[^}]*\? "system" : "mine"\}/, name);
    assert.doesNotMatch(src, />Mine</, name);
    assert.doesNotMatch(src, />System</, name);
  }
  assert.doesNotMatch(shared, /export function FilterGroup/);
  assert.doesNotMatch(rxForm, /t\.isSystemTemplate \? "System" : "Mine"/);
  assert.doesNotMatch(c2, /isSystemTemplate \? " \(system\)"/);
  assert.doesNotMatch(c2, /is_system_template \? " \(system\)"/);
});

test('A1: each tab renders Edit/Duplicate/Delete (Favorites: Edit/Delete only)', () => {
  for (const name of ['soap', 'rx', 'certs', 'diagnoses', 'phrases']) {
    const src = tabs[name];
    assert.match(src, />Edit</, `${name} Edit`);
    assert.match(src, />Duplicate</, `${name} Duplicate`);
    assert.match(src, />Delete</, `${name} Delete`);
  }
  assert.match(tabs.favorites, />Edit</);
  assert.match(tabs.favorites, />Delete</);
  assert.doesNotMatch(tabs.favorites, />Duplicate</);
});

test('A4: restore link + in-app modal on tabs with built-ins; Favorites omitted; no window.confirm', () => {
  assert.match(clinical, /restoreBuiltInTemplates/);
  assert.match(clinical, /\/api\/templates\/restore-built-ins/);
  assert.match(shared, /Restore built-in templates/);
  assert.match(shared, /title="Restore built-in templates\?"/);
  assert.match(shared, /This adds back any built-in templates you deleted\. Your own templates and edits are not changed\./);
  assert.match(shared, />Restore</);
  assert.match(shared, />Cancel</);
  assert.match(tabs.soap, /kind="soap"/);
  assert.match(tabs.rx, /kind="rx"/);
  assert.match(tabs.certs, /kind="cert"/);
  assert.match(tabs.diagnoses, /kind="diagnosis"/);
  assert.match(tabs.phrases, /kind="phrase"/);
  assert.doesNotMatch(tabs.favorites, /RestoreBuiltIns/);
  assert.doesNotMatch(tabs.favorites, /Restore built-in templates/);
  for (const src of [...Object.values(tabs), shared, ws]) {
    assert.doesNotMatch(src, /window\.confirm\(/);
  }
});
