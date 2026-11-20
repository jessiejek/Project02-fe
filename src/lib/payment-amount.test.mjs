// JJQR - AI (Nov 20, 2026) - B-03 unit tests. Run: `npm run test:unit`
import test from "node:test";
import assert from "node:assert/strict";
import { checkAmountReceived } from "./payment-amount.ts";

test("exact fee and more (cash with change) are accepted", () => {
  assert.deepEqual(checkAmountReceived("450", 450), { ok: true, value: 450 });
  assert.deepEqual(checkAmountReceived("₱1,000", 450), { ok: true, value: 1000 });
  assert.deepEqual(checkAmountReceived("450.50", 450), { ok: true, value: 450.5 });
});

test("blank / not a number / zero / negative / too small / huge are all refused with a message", () => {
  for (const bad of ["", "   ", "abc", "NaN", "12abc", "1e3", "0", "-50", "10", "449.99", "99999999", "4 5 0.123"]) {
    const r = checkAmountReceived(bad, 450);
    assert.equal(r.ok, false, `"${bad}" should be refused`);
    assert.ok(r.error.length > 5);
  }
});

test("a free visit (due ₱0) still needs a real number, but 0 is not a payment", () => {
  assert.equal(checkAmountReceived("0", 0).ok, false);
  assert.equal(checkAmountReceived("1", 0).ok, true);
});
