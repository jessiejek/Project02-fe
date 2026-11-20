//JJQR Nov 20, 2026
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { followUpModeSatisfied } from "./pf-default.ts";

test("followUpModeSatisfied: dated needs date", () => {
  assert.equal(followUpModeSatisfied("dated", ""), false);
  assert.equal(followUpModeSatisfied("dated", "2026-01-15"), true);
});

test("followUpModeSatisfied: prn and none always satisfied", () => {
  assert.equal(followUpModeSatisfied("prn", ""), true);
  assert.equal(followUpModeSatisfied("none", ""), true);
});

test("page.tsx: no redundant no-follow-up checkbox gate copy", () => {
  const src = readFileSync(
    new URL("../app/doctor/consultation2/[bookingId]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    src.includes("Required for Complete when you are not scheduling follow-up"),
    false,
  );
  assert.match(src, /followUpModeSatisfied/);
  assert.match(src, /No follow-up will be scheduled for this visit/);
});

test("page.tsx: save path treats none without extra checkbox", () => {
  const src = readFileSync(
    new URL("../app/doctor/consultation2/[bookingId]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /if \(followUpMode === "none"\) \{/);
  assert.equal(/followUpMode === "none" && noFollowUpConfirmed/.test(src), false);
});
//JJQR - END