//JJQR - AI (Nov 19, 2026) - source-level wiring checks for the templates workspace (Phase 2 UI)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('workspace wiring: route keeps the h1 + e2e selectors, panel is guarded, deletes are undoable', () => {
  const page = read('app/doctor/templates/page.tsx');
  assert.match(page, /<h1[^>]*>Consultation templates<\/h1>/);
  assert.match(page, /TemplatesWorkspace/);
  const ws = read('components/doctor/templates/TemplatesWorkspace.tsx');
  assert.match(ws, /"Search this tab…"/);
  assert.match(ws, /const label = `\$\{TAB_LABELS\[id\]\} \(\$\{counts\[id\]\}\)`/);
  assert.doesNotMatch(ws, /role="tab"/); // e2e uses getByRole('button', { name: /SOAP \\(\\d+\\)/ })
  const panel = read('components/ui/SidePanel.tsx');
  assert.match(panel, /e\.key === "Escape"/);
  assert.match(panel, /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === "s"/);
  assert.match(panel, /Discard unsaved changes\?/);
  const undo = read('components/doctor/templates/useUndoableDelete.ts');
  assert.match(undo, /UNDO_MS = 5000/);
  const soap = read('components/doctor/templates/SoapTab.tsx');
  //JJQR - AI (Nov 20, 2026) A3 — Specialty chips no longer live on the templates SOAP tab
  assert.doesNotMatch(soap, /SPECIALTY_CHIP_LABELS/);
});

test('consultation2 + Rx form use the new template data (ICD code on Dx, full Rx-pad fields on Rx sets)', () => {
  const c2 = read('app/doctor/consultation2/[bookingId]/page.tsx');
  assert.match(c2, /addDiagnosisLine\(t\.body, t\.icd10_code \?\? null\)/);
  assert.match(c2, /createDiagnosisTemplate\(null as never, \{ label, body, icd10_code: null \}\)/);
  const rx = read('components/doctor/PrescriptionForm.tsx');
  assert.match(rx, /function lineItemToTemplatePayload/);
  for (const f of ['route', 'meal_relation', 'timing', 'duration_kind', 'duration_value', 'indication']) {
    assert.match(rx, new RegExp(`${f}: i\\.`), `${f} must be mapped when saving a template`);
  }
  // every save path (Add to Template + modal save) goes through the one mapper
  assert.equal((rx.match(/lineItemToTemplatePayload/g) ?? []).length, 3);
  assert.match(rx, /mealRelation: i\.meal_relation === "Before"/);
});

// ── browser Back guard ─────────────────────────────────────────────────────────
function loadGuard(win) {
  const container = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read('lib/templates/historyGuard.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: container, exports: container.exports, window: win });
  return container.exports;
}
function fakeWindow() {
  const listeners = [];
  const stack = [{ state: { __NA: true } }];
  let i = 0;
  const win = {
    location: { href: 'http://x/doctor/templates?tab=phrases&id=new' },
    history: {
      get state() { return stack[i].state; },
      pushState(state) { stack.splice(i + 1); stack.push({ state }); i++; },
      go(n) { i += n; setTimeout(() => listeners.slice().forEach((l) => l()), 0); },
    },
    addEventListener(t, l) { if (t === 'popstate') listeners.push(l); },
    removeEventListener(t, l) { const k = listeners.indexOf(l); if (k >= 0) listeners.splice(k, 1); },
    back() { win.history.go(-1); },
    get depth() { return i; },
  };
  return win;
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test('historyGuard: arming adds exactly one sentinel entry and keeps Next internal state', () => {
  const win = fakeWindow();
  const g = loadGuard(win);
  g.armHistoryGuard();
  g.armHistoryGuard();
  assert.equal(win.depth, 1);
  assert.equal(win.history.state.__NA, true);
  assert.equal(win.history.state.tplGuard, true);
  assert.equal(g.isGuardArmed(), true);
});

test('historyGuard: Back is consumed, guard re-armed, and closing leaves no stray entry', async () => {
  const win = fakeWindow();
  const g = loadGuard(win);
  let prompts = 0;
  win.addEventListener('popstate', () => { if (g.isReleasingGuard()) return; g.markGuardConsumed(); g.armHistoryGuard(); prompts++; });
  g.armHistoryGuard();
  win.back(); // user presses browser Back with unsaved edits
  await tick();
  assert.equal(prompts, 1);
  assert.equal(win.depth, 1, 'still guarded: the page did not change and a new sentinel sits on top');
  let closed = 0;
  g.releaseHistoryGuard(() => { closed++; });
  await tick();
  assert.equal(closed, 1);
  assert.equal(win.depth, 0, 'sentinel removed — no extra history entry left');
  assert.equal(prompts, 1, 'our own pop must not re-open the prompt');
});

test('historyGuard: nothing armed → close runs immediately', () => {
  const g = loadGuard(fakeWindow());
  let ran = false;
  g.releaseHistoryGuard(() => { ran = true; });
  assert.equal(ran, true);
});

test('side panel + workspace wire the Back guard', () => {
  const panel = read('components/ui/SidePanel.tsx');
  assert.match(panel, /addEventListener\("popstate", onPop\)/);
  assert.match(panel, /setConfirmOpen\(true\)/);
  assert.match(read('components/doctor/templates/TemplatesWorkspace.tsx'), /releaseHistoryGuard\(\(\) => go\(buildTemplatesUrl/);
});
//JJQR - END
