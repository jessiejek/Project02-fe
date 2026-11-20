//JJQR - AI (Nov 20, 2026)
// Guard: /logout must bypass proxy silent-refresh so a single Logout click clears the session.
// Run: `node --test src/lib/auth/logout-proxy.test.mjs`
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../.."); // .../src

test("source: proxy matcher excludes logout (next to serwist|sw.js)", () => {
  const src = readFileSync(join(SRC, "proxy.ts"), "utf8");
  assert.match(src, /export const config/);
  assert.match(src, /matcher/);
  // Negative-lookahead list must include logout beside serwist|sw.js so /logout never hits proxy.
  assert.match(src, /logout\|serwist\|sw\\\\\.js/);
});

test("source: proxy early-returns NextResponse.next() for /logout", () => {
  const src = readFileSync(join(SRC, "proxy.ts"), "utf8");
  const proxyFn = src.match(/export async function proxy\([\s\S]*?\n\}/);
  assert.ok(proxyFn, "proxy() function source must be present");
  assert.match(
    proxyFn[0],
    /if \(request\.nextUrl\.pathname === ["']\/logout["']\) return NextResponse\.next\(\);/,
  );
  // Defense must run before cookie read / silent refresh.
  const early = proxyFn[0].indexOf('pathname === "/logout"');
  const refresh = proxyFn[0].indexOf("dotnetAuth.refresh");
  assert.ok(early !== -1 && refresh !== -1 && early < refresh);
});

test("source: logout route clears session cookies", () => {
  const src = readFileSync(join(SRC, "app/logout/route.ts"), "utf8");
  assert.match(src, /clearSessionCookies/);
  assert.match(src, /REFRESH_COOKIE/);
  assert.match(src, /dotnetAuth\.logout/);
});
//JJQR - END
