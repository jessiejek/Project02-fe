//JJQR - AI (Nov 25, 2026) - owner ("just trap the 2nd transaction")
import test from "node:test";
import assert from "node:assert/strict";
import { isNoLongerUnpaid } from "./payment-conflict.ts";

test("409 not_unpaid is recognised; other refusals are not", () => {
  assert.equal(isNoLongerUnpaid({ status: 409, body: { error: "not_unpaid", message: "This visit is no longer unpaid (it was just recorded)." } }), true);
  assert.equal(isNoLongerUnpaid({ status: 409, body: { error: "or_number_duplicate" } }), false);
  assert.equal(isNoLongerUnpaid({ status: 400, body: { error: "not_unpaid" } }), false);
  assert.equal(isNoLongerUnpaid({ status: 409, body: "" }), false);
  assert.equal(isNoLongerUnpaid(new Error("x")), false);
  assert.equal(isNoLongerUnpaid(undefined), false);
});
//JJQR - END
