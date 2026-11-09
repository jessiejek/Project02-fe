import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('design system defines the body-sm type role that pages already use', () => {
  assert.match(read('app/globals.css'), /--text-body-sm: 13px;/);
  assert.match(read('app/globals.css'), /--container-page-heading:/);
});

test('sign-in pages share one auth frame, persistent labels and semantic alerts', () => {
  for (const p of ['app/login/page.tsx', 'app/register/page.tsx', 'app/forgot-password/page.tsx']) {
    const src = read(p);
    assert.match(src, /<AuthShell/, p);
    assert.match(src, /labelStyles/, p);
    assert.doesNotMatch(src, /bg-green-50|text-green-800/, p);
  }
  assert.match(read('app/login/page.tsx'), /"Log in"/);
  assert.match(read('app/login/page.tsx'), /autoComplete="current-password"/);
});

test('password reset never reveals whether an account exists', () => {
  const src = read('app/forgot-password/page.tsx');
  assert.match(src, /If an account exists for/);
  assert.match(src, /loading={submitting}/);
});

test('public home highlights today from the clinic timezone, not the viewer', () => {
  const src = read('app/page.tsx');
  assert.match(src, /getUTCDay/);
  assert.match(src, /aria-current={isToday \? "date"/);
});
