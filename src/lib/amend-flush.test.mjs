//JJQR - AI (Nov 20, 2026)
import test from "node:test";
import assert from "node:assert/strict";
import { shouldFlush, shouldFlushPrescription } from "./amend-flush.ts";

test("shouldFlush: equal snapshots are a no-op", () => {
  assert.equal(shouldFlush({ a: 1 }, { a: 1 }), false);
  assert.equal(shouldFlush(["x"], ["x"]), false);
});

test("shouldFlush: different snapshots need a write", () => {
  assert.equal(shouldFlush({ a: 1 }, { a: 2 }), true);
  assert.equal(shouldFlush(["x"], ["y"]), true);
  assert.equal(shouldFlush({ pulse: "80" }, { pulse: "88" }), true);
});

test("shouldFlushPrescription: empty list with no group is nothing-to-do", () => {
  assert.equal(shouldFlushPrescription([], [], false), false);
  assert.equal(shouldFlushPrescription([], [{ genericName: "Amox" }], false), false);
});

test("shouldFlushPrescription: emptying an existing group must flush", () => {
  assert.equal(shouldFlushPrescription([], [{ genericName: "Amox" }], true), true);
});

test("shouldFlushPrescription: unchanged existing group is a no-op", () => {
  const items = [{ genericName: "Amox", quantity: "10" }];
  assert.equal(shouldFlushPrescription(items, items, true), false);
});

test("shouldFlushPrescription: added or edited lines must flush even with no group yet", () => {
  assert.equal(shouldFlushPrescription([{ genericName: "New" }], [], false), true);
  assert.equal(
    shouldFlushPrescription([{ genericName: "Amox", quantity: "21" }], [{ genericName: "Amox", quantity: "10" }], true),
    true,
  );
});
//JJQR - END
