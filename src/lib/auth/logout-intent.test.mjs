//JJQR Nov 20, 2026
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { markLogoutPending, isLogoutPending, clearLogoutPending } from "./logout-intent.ts";

function mem() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; }

test("pending right after the click, so a reload resumes the logout", () => {
  const s = mem(); markLogoutPending(s, 1000);
  assert.equal(isLogoutPending(s, 1500), true);
});
test("expires after 20s (no logout loop)", () => {
  const s = mem(); markLogoutPending(s, 1000);
  assert.equal(isLogoutPending(s, 1000 + 20_001), false);
  assert.equal(isLogoutPending(s, 1500), false);
});
test("cleared by the login page", () => {
  const s = mem(); markLogoutPending(s, 1000); clearLogoutPending(s);
  assert.equal(isLogoutPending(s, 1001), false);
});
test("wiring: Sidebar marks + resumes, login clears", () => {
  const side = readFileSync(new URL("../../components/shell/Sidebar.tsx", import.meta.url), "utf8");
  assert.match(side, /markLogoutPending\(window\.sessionStorage\)/);
  assert.match(side, /isLogoutPending\(window\.sessionStorage\)\) window\.location\.replace\("\/logout"\)/);
  const login = readFileSync(new URL("../../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /clearLogoutPending\(window\.sessionStorage\)/);
});
//JJQR - END
