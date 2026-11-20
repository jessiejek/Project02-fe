//JJQR Nov 20, 2026
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adjacentSection } from './clinical/consult-steps.ts';

const order = [0, 1, 3, 4, 6]; // Diagnosis (2) hidden
test('prev/next skip hidden sections and stop at the ends', () => {
  assert.equal(adjacentSection(order, 1, 'next'), 3);
  assert.equal(adjacentSection(order, 3, 'prev'), 1);
  assert.equal(adjacentSection(order, 0, 'prev'), null);
  assert.equal(adjacentSection(order, 6, 'next'), null);
  assert.equal(adjacentSection(order, 2, 'next'), null); // not in order
  assert.equal(adjacentSection([], 0, 'next'), null);
});

test('consult action bar has Prev/Next that only navigate', () => {
  const src = readFileSync(new URL('../app/doctor/consultation2/[bookingId]/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /adjacentSection\(visibleSectionOrder, openSection, "prev"\)/);
  assert.match(src, /adjacentSection\(visibleSectionOrder, openSection, "next"\)/);
  assert.match(src, /data-testid="consult-prev-section"/);
  assert.match(src, /data-testid="consult-next-section"/);
  const fn = src.slice(src.indexOf('function stepSection'), src.indexOf('Explicit escape hatch'));
  assert.match(fn, /goToSection\(target\)/);
  assert.doesNotMatch(fn, /save|Save|validate|setCompleteAttempted/);
});
