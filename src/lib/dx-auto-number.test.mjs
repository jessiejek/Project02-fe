//JJQR - AI (2026-11-27) - why: Enter auto-numbering in the "Each on its own line" Diagnosis box (same cases as the desktop DxAutoNumberTests)
import test from "node:test";
import assert from "node:assert/strict";
import { dxAutoNumberEdit as ed } from "./clinical/dx-auto-number.ts";

const enterAt = (s, i, nl = "\n") => ed(s, s.slice(0, i) + nl + s.slice(i));
const type = (s, i, ch) => ed(s, s.slice(0, i) + ch + s.slice(i));

test("Enter after '1) text' adds '2) ' (and keeps ')' or '.')", () => {
  assert.deepEqual(enterAt("1) URTI", 7), { text: "1) URTI\n2) ", caret: 11 });
  assert.deepEqual(enterAt("1) URTI\n2) DENGUE FEVER", 23), { text: "1) URTI\n2) DENGUE FEVER\n3) ", caret: 27 });
  assert.deepEqual(enterAt("9. AGE", 6), { text: "9. AGE\n10. ", caret: 11 });
  assert.deepEqual(enterAt("1) URTI", 7, "\r"), { text: "1) URTI\r2) ", caret: 11 });
});

test("Enter on a blank numbered line removes the marker", () => {
  assert.deepEqual(enterAt("1) URTI\n2) ", 11), { text: "1) URTI\n", caret: 8 });
  assert.deepEqual(enterAt("1) URTI\n2)", 10), { text: "1) URTI\n", caret: 8 });
});

test("typing the number yourself after the automatic one keeps only yours", () => {
  assert.deepEqual(type("1) URTI\n2) 2", 12, ")"), { text: "1) URTI\n2)", caret: 10 });
  assert.deepEqual(type("1) URTI\n2) 3", 12, "."), { text: "1) URTI\n3.", caret: 10 });
});

test("no change: plain text, mid-line split before an existing marker, paste, Windows \\r\\n second half, ordinary typing", () => {
  assert.equal(enterAt("URTI", 4), null);
  assert.equal(enterAt("1) URTI 2) AGE", 8), null);
  assert.equal(ed("1) URTI", "1) URTI\n2) AGE"), null);
  assert.equal(ed("1) URTI\r", "1) URTI\r\n"), null);
  assert.equal(type("1) URT", 6, "I"), null);
  assert.equal(type("Paracetamol 2", 13, "."), null);
});

test("Enter in the middle of a numbered line moves the rest to the new numbered line", () => {
  assert.deepEqual(enterAt("1) URTI DENGUE", 7), { text: "1) URTI\n2) DENGUE", caret: 11 });
});
//JJQR - END
