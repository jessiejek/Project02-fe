import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function compile(path, imports, extra = {}) {
  const output = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const container = { exports: {} };
  vm.runInNewContext(output, { module: container, exports: container.exports, require: imports, ...extra }, { filename: path });
  return container.exports;
}
function account(fetch) {
  return compile('lib/auth/account.ts', name => {
    assert.equal(name, '@/lib/api/client');
    return { API_BASE_URL: 'https://not-connected.invalid', api: {}, ApiError: class extends Error {} };
  }, { fetch });
}

test('verification feedback reports acceptance without claiming delivery', async () => {
  let calls = 0;
  const client = account(async (url, options) => {
    calls++; assert.equal(url, 'https://not-connected.invalid/api/auth/resend-verification');
    assert.equal(options.method, 'POST'); return { ok: true };
  });
  assert.equal(await client.resendVerification('fixture@example.invalid'), true);
  assert.equal(calls, 1);
});
test('verification HTTP errors do not produce false success', async () => {
  assert.equal(await account(async () => ({ ok: false })).resendVerification('fixture@example.invalid'), false);
});
test('verification offline failures do not produce false success', async () => {
  assert.equal(await account(async () => { throw new Error('Offline fixture'); }).resendVerification('fixture@example.invalid'), false);
});
test('pending buttons are disabled and announce work even without motion', () => {
  const styles = compile('components/ui/buttonStyles.ts', () => ({ cn: (...classes) => classes.filter(Boolean).join(' ') }));
  const { Button } = compile('components/ui/Button.tsx', name => {
    if (name === './buttonStyles') return styles;
    if (name === '@/lib/cn') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
    return require(name);
  });
  const html = renderToStaticMarkup(React.createElement(Button, { loading: true }, 'Save'));
  assert.match(html, /disabled=""/); assert.match(html, /aria-busy="true"/);
  assert.match(html, /Working…/); assert.match(html, /motion-reduce:hidden/);
  assert.match(html, /motion-reduce:not-sr-only/);
});
test('semantic status foregrounds meet AA normal-text contrast', () => {
  const css = read('app/globals.css');
  const color = name => css.match(new RegExp(`--color-status-${name}: (#[0-9a-f]{6});`))[1];
  const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  for (const tone of ['success', 'warning', 'danger', 'info', 'neutral']) {
    const values = [luminance(color(tone)), luminance(color(`${tone}-surface`))].sort((a, b) => a - b);
    assert.ok((values[1] + .05) / (values[0] + .05) >= 4.5, `${tone} normal text contrast`);
  }
});
test('route and table loading states have non-animated accessible feedback', () => {
  assert.match(read('app/error.tsx'), /unstable_retry/);
  assert.match(read('app/loading.tsx'), /RouteLoading/);
  assert.match(read('components/ui/RouteLoading.tsx'), /motion-reduce:animate-none/);
  assert.match(read('components/ui/DataTable.tsx'), /aria-busy={loading/);
  assert.match(read('components/ui/Skeleton.tsx'), /aria-hidden="true"/);
});
test('dashboards expose recovery and do not treat failed ratings as no reviews', () => {
  for (const path of ['app/admin/dashboard/page.tsx', 'app/patient/dashboard/page.tsx']) {
    assert.match(read(path), /catch/); assert.match(read(path), /loadError/); assert.match(read(path), /<ErrorState/);
  }
  assert.match(read('app/patient/dashboard/page.tsx'), /Reviews unavailable/);
  assert.match(read('app/patient/dashboard/page.tsx'), /cancelled = true/);
  assert.match(read('app/admin/dashboard/page.tsx'), /requestId !== loadId.current/);
});
test('public unavailable details provide retry instead of invented hours or fees', () => {
  const source = read('app/page.tsx');
  assert.match(source, /Some clinic details are unavailable/);
  assert.match(source, /<RefreshButton/);
  assert.match(source, /!h \? "Not provided"/);
  assert.match(source, /Number.isFinite\(n\)/);
});
