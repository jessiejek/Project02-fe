//JJQR - AI (Nov 21, 2026) - desktop login: remember the email (never the password)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");

test("only the desktop build shows the remember option; the web login is unchanged", () => {
  assert.match(src, /const isDesktop = process\.env\.NEXT_PUBLIC_LOCAL_NODE === "1";/);
  assert.match(src, /\{isDesktop && \(\s*<div className="space-y-xs">/);
  assert.match(src, /Remember my email on this computer/);
});

test("the email is prefilled from this computer's storage and saved only after a successful login", () => {
  assert.match(src, /window\.localStorage\.getItem\(REMEMBERED_EMAIL_KEY\)/);
  assert.match(src, /if \(rememberEmail\) window\.localStorage\.setItem\(REMEMBERED_EMAIL_KEY, email\.trim\(\)\);\s*else window\.localStorage\.removeItem\(REMEMBERED_EMAIL_KEY\);/);
  // the save happens after the login succeeded (after the error return), before navigating
  assert.ok(src.indexOf("localStorage.setItem(REMEMBERED_EMAIL_KEY") > src.indexOf("setSubmitting(false);\n      return;"));
});

test("the password is never written to storage", () => {
  assert.equal(/localStorage\.setItem\([^)]*password/i.test(src), false);
  assert.equal(/sessionStorage\.setItem\([^)]*password/i.test(src), false);
  assert.match(src, /the password is never saved/);
});
//JJQR - END
