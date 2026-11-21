// JJQR - AI (Nov 20, 2026) - B-03 unit tests. Run: `npm run test:unit`
import test from "node:test";
import assert from "node:assert/strict";
import { checkAmountReceived } from "./payment-amount.ts";

//JJQR - AI (Nov 21, 2026) - EXACT: the amount the doctor set, nothing more, nothing less
test("only the exact amount due is accepted", () => {
  assert.deepEqual(checkAmountReceived("450", 450), { ok: true, value: 450 });
  assert.deepEqual(checkAmountReceived("₱450.00", 450), { ok: true, value: 450 });
  assert.deepEqual(checkAmountReceived("450.50", 450.5), { ok: true, value: 450.5 });
});

test("one peso more or less, or cash with change, is refused with the exact amount in the message", () => {
  for (const bad of ["449", "449.99", "451", "450.01", "500", "₱1,000"]) {
    const r = checkAmountReceived(bad, 450);
    assert.equal(r.ok, false, `"${bad}" must be refused`);
    assert.match(r.error, /exactly ₱450/);
  }
});

test("blank / not a number / zero / negative / too small / huge are all refused with a message", () => {
  for (const bad of ["", "   ", "abc", "NaN", "12abc", "1e3", "0", "-50", "10", "449.99", "99999999", "4 5 0.123"]) {
    const r = checkAmountReceived(bad, 450);
    assert.equal(r.ok, false, `"${bad}" should be refused`);
    assert.ok(r.error.length > 5);
  }
});

test("a free visit (due ₱0) is never 'collected' (a doctor's waiver is confirmed separately)", () => {
  assert.equal(checkAmountReceived("0", 0).ok, false);
  assert.equal(checkAmountReceived("1", 0).ok, false);
});
