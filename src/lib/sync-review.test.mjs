//JJQR - AI (Nov 22, 2026) - offline-mode plan step 4.5: rules of the Sync review page. Run: `npm run test:unit`
import test from "node:test";
import assert from "node:assert/strict";
import { kindLabel, kindHelp, kindTone, isDuplicate, noteProblem, countsText, totalRecords, mergeSummary, fullName, compareRows, problemMessage, REVIEW_KINDS } from "./sync-review.ts";

test("every kind has a label, a help sentence and a tone", () => {
  for (const k of REVIEW_KINDS) {
    assert.ok(kindLabel(k).length > 5);
    assert.ok(kindHelp(k).length > 20);
    assert.notEqual(kindTone(k), "neutral");
  }
  assert.equal(kindLabel("something_new"), "something_new"); // an unknown kind still shows something
  assert.equal(kindHelp("something_new"), "");
});

test("only a possible duplicate is closed by merging", () => {
  assert.equal(isDuplicate("possible_duplicate_patient"), true);
  for (const k of ["or_number_clash", "change_rejected", "change_stuck"]) assert.equal(isDuplicate(k), false);
});

test("a note needs 5 to 1000 characters (spaces do not count)", () => {
  assert.match(noteProblem("   hi  "), /at least 5/);
  assert.equal(noteProblem("Checked the booklet"), null);
  assert.match(noteProblem("x".repeat(1001)), /too long/);
  assert.equal(noteProblem("x".repeat(1000)), null);
});

test("counts read as plain words, singular and plural", () => {
  assert.equal(countsText({ bookings: 3, consultations: 1, allergies: 2, vitals: 0 }), "3 visits, 1 consultation, 2 allergies");
  assert.equal(countsText({ bookings: 0 }), "No records");
  assert.equal(countsText(null), "No records");
  assert.equal(countsText({ medical_certificates: 1 }), "1 medical certificate");
  assert.equal(totalRecords({ a: 2, b: 3 }), 5);
});

test("the merge summary says what moves, what is kept and that it cannot be undone", () => {
  const s = mergeSummary("Ana Cruz", "MF-1", "Ana M Cruz", "MF-2", { bookings: 2, allergies: 1 });
  assert.match(s, /2 visits, 1 allergy/);
  assert.match(s, /will move to Ana Cruz \(MF-1\)/);
  assert.match(s, /only fields that are empty on Ana Cruz are filled/);
  assert.match(s, /cannot be undone/);
  assert.match(mergeSummary("A", "1", "B", "2", {}), /no records to move/);
});

test("the comparison marks the rows that differ and ignores capitals", () => {
  const rows = compareRows(
    { first_name: "Maria", last_name: "Cruz", address: null, email: "a@x.com", contact_number: "0917" },
    { first_name: "MARIA", last_name: "Cruz", address: "12 Old St", email: "a@x.com", contact_number: "0999" },
  );
  const by = Object.fromEntries(rows.map((r) => [r.label, r]));
  assert.equal(by["First name"].differs, false);
  assert.equal(by["Address"].a, "—");
  assert.equal(by["Address"].differs, true);
  assert.equal(by["Contact number"].differs, true);
  assert.equal(by["Email"].differs, false);
});

test("names and server messages", () => {
  assert.equal(fullName({ first_name: "Ana", middle_name: null, last_name: "Cruz" }), "Ana Cruz");
  assert.equal(fullName({ first_name: "Ana", middle_name: "Maria", last_name: "Cruz" }), "Ana Maria Cruz");
  assert.equal(problemMessage({ message: "Both patients have accounts." }, "x"), "Both patients have accounts.");
  assert.equal(problemMessage(null, "Something went wrong."), "Something went wrong.");
});
//JJQR - END
