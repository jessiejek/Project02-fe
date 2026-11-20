//JJQR Nov 20, 2026
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialPfDecision } from "./pf-default.ts";

test("initialPfDecision: null -> charge", () => {
  assert.equal(initialPfDecision(null), "charge");
});

test("initialPfDecision: undefined -> charge", () => {
  assert.equal(initialPfDecision(undefined), "charge");
});

test("initialPfDecision: Charge -> charge", () => {
  assert.equal(initialPfDecision({ type: "Charge" }), "charge");
});

test("initialPfDecision: Waive -> waive", () => {
  assert.equal(initialPfDecision({ type: "Waive" }), "waive");
});

test("page.tsx loaders no longer fall back to null", () => {
  const src = readFileSync(
    new URL("../app/doctor/consultation2/[bookingId]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(/setPfDecision\([^)]*\?[^)]*:\s*null\)/.test(src), false);
});
//JJQR - END
