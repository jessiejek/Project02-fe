//JJQR - AI (2026-11-25) - "Consultation saved" shows the amount actually charged, not the fee loaded when the page opened
import test from "node:test";
import assert from "node:assert/strict";
import { savedSummaryAmount } from "./clinical/saved-fee.ts";

test("switched to Follow-up: the form's ₱400, not the booking's old ₱500", () => {
  assert.equal(savedSummaryAmount("", "400", 500), "400");
});
test("a typed (saved) amount wins", () => {
  assert.equal(savedSummaryAmount("350", "400", 500), "350");
});
test("nothing on the form: the booking's fee; nothing at all: empty", () => {
  assert.equal(savedSummaryAmount("", "", 500), "500");
  assert.equal(savedSummaryAmount("", " ", 0), "");
  assert.equal(savedSummaryAmount("", "", null), "");
});
//JJQR - END
