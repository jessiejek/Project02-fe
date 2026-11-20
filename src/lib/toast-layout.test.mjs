//JJQR Nov 20, 2026
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('ToastHost does not use max-w-md (resolves to --spacing-md = 16px in this theme)', () => {
  const host = read('components/ui/ToastHost.tsx');
  assert.doesNotMatch(host, /className="[^"]*max-w-(xs|sm|md|lg|xl)\b/);
  assert.match(host, /max-w-\[min\(92vw,480px\)\]/);
  assert.match(host, /min-w-\[min\(92vw,320px\)\]/);
  assert.match(host, /fixed bottom-6 left-1\/2/);
});

test('Toast keeps icon, message, Undo and close inside one card row', () => {
  const t = read('components/ui/Toast.tsx');
  assert.match(t, /flex w-full items-center gap-md rounded-lg border/);
  assert.match(t, /min-w-0 flex-1/);
  assert.match(t, /line-clamp-2/);
  assert.match(t, /shrink-0 whitespace-nowrap[^"]*underline/); // Undo button is a sibling, not inside <p>
  const p = t.slice(t.indexOf('<p '), t.indexOf('</p>'));
  assert.doesNotMatch(p, /<button/);
  for (const v of ['info', 'success', 'error', 'warning']) assert.match(t, new RegExp(`${v}: "bg-status-`));
});
