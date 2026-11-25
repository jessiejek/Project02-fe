//JJQR - AI (2026-11-25) - "New Prescription" on a visit that already has one asks before replacing it
import test from "node:test";
import assert from "node:assert/strict";
import { needsRxReplaceConfirm, RX_REPLACE_QUESTION } from "./rx-replace.ts";

test("visit already has a prescription -> ask", () => {
  assert.equal(needsRxReplaceConfirm(false, [{ prescription_line_items: [{ generic_name: "Paracetamol" }] }]), true);
});
test("no prescription on the visit (none, or an empty one) -> no question", () => {
  assert.equal(needsRxReplaceConfirm(false, []), false);
  assert.equal(needsRxReplaceConfirm(false, null), false);
  assert.equal(needsRxReplaceConfirm(false, [{ prescription_line_items: [] }]), false);
});
test("editing the visit's own prescription (form loaded/saved it) -> no question", () => {
  assert.equal(needsRxReplaceConfirm(true, [{ prescription_line_items: [{}] }]), false);
});
test("exact wording", () => {
  assert.equal(RX_REPLACE_QUESTION, "This visit already has a prescription. Replace it?");
});
//JJQR - END
