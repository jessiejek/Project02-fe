import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('headlines balance and numeric values use tabular figures', () => {
  assert.match(read('app/globals.css'), /text-wrap: balance/);
  assert.match(read('components/ui/Card.tsx'), /tabular-nums/);
});
test('appointment labels do not claim that every future booking is today', () => {
  const page = read('app/patient/dashboard/page.tsx');
  assert.match(page, /Next Appointment/);
  assert.doesNotMatch(page, /Your Appointment Today|eyebrow="Today"/);
  assert.ok(page.indexOf('Next Appointment') < page.indexOf('label="Active Appointments"'));
});
test('rendering no longer depends on a remote Google font fetch', () => {
  assert.doesNotMatch(read('app/layout.tsx'), /next\/font\/google/);
});
