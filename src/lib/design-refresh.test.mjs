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

test('status pills and banners share semantic status tokens', () => {
  assert.match(read('components/ui/StatusPill.tsx'), /bg-status-success-surface/);
  assert.match(read('components/ui/Toast.tsx'), /bg-status-success-surface/);
  assert.match(read('app/globals.css'), /--color-status-success:/);
});
test('static cards do not lift and patient links do not contain buttons', () => {
  assert.doesNotMatch(read('app/globals.css'), /\.bento-card:hover/);
  assert.match(read('app/globals.css'), /\.bento-card--interactive:hover/);
  assert.doesNotMatch(read('app/patient/dashboard/page.tsx'), /<Button/);
  assert.match(read('components/ui/DataTable.tsx'), /handleRowKey/);
});

test('semantic status styling does not replace the bundled icon vocabulary', () => {
  const src = read('components/ui/StatusPill.tsx');
  const icons = src.slice(src.indexOf('const TONE_ICON'), src.indexOf('// Every status'));
  assert.match(icons, /check_circle/); assert.doesNotMatch(icons, /bg-status/);
});
