//JJQR - AI (2026-11-26) - GAV-11: "Wrong patient?" dialog rules (wrong-patient.ts)
import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_NEW_PATIENT, defaultAllergyIds, wrongPatientProblem, reassignBody, warningFrom, movesSummary, slipHtml } from "./wrong-patient.ts";

const today = "2026-11-26";
const form = { ...EMPTY_NEW_PATIENT, firstName: "jessie", lastName: "rubi", dateOfBirth: "1999-09-09" };

test("allergies recorded during the visit are ticked by default, older ones are not", () => {
  const ids = defaultAllergyIds([
    { id: "a", allergen: "Latex", is_nkda: false, added_during_visit: true },
    { id: "b", allergen: "Penicillin", is_nkda: false, added_during_visit: false },
  ]);
  assert.deepEqual(ids, ["a"]);
});

test("confirm needs a valid new patient or a chosen other patient, and a reason", () => {
  const base = { mode: "new", form, targetId: null, currentPatientId: "p1", reason: "Different person" };
  assert.equal(wrongPatientProblem(base, today), null);
  assert.match(wrongPatientProblem({ ...base, form: { ...form, firstName: "" } }, today), /First name/);
  assert.match(wrongPatientProblem({ ...base, reason: "no" }, today), /at least 5/);
  assert.match(wrongPatientProblem({ ...base, mode: "existing" }, today), /choose the patient/);
  assert.match(wrongPatientProblem({ ...base, mode: "existing", targetId: "p1" }, today), /already under that patient/);
  assert.equal(wrongPatientProblem({ ...base, mode: "existing", targetId: "p2" }, today), null);
});

test("body: new patient carries its own id (retry-safe) and title-cased names; existing sends only the target", () => {
  const n = reassignBody({ mode: "new", form, newPatientId: "np-1", targetId: null, reason: " Different person ", allergyIds: ["a"] });
  assert.equal(n.new_patient.patient_id, "np-1");
  assert.equal(n.new_patient.first_name, "Jessie");
  assert.equal(n.reason, "Different person");
  assert.deepEqual(n.move_allergy_ids, ["a"]);
  assert.equal(n.target_patient_id, undefined);
  const e = reassignBody({ mode: "existing", form, newPatientId: "np-1", targetId: "p2", reason: "Theirs", allergyIds: [], ackSameDay: true });
  assert.equal(e.target_patient_id, "p2");
  assert.equal(e.new_patient, undefined);
  assert.equal(e.acknowledge_same_day_visit, true);
});

test("server warnings become questions, other errors stay errors", () => {
  const w = warningFrom(409, { error: "target_has_visit_that_day", message: "Has a visit", visits: [{ queue_number: "R-007" }] });
  assert.equal(w.kind, "same_day"); assert.deepEqual(w.queueNumbers, ["R-007"]);
  const d = warningFrom(409, { error: "possible_duplicate", message: "Same", matches: [{ patient_id: "x", patient_code: "MF-1", first_name: "A", last_name: "B", date_of_birth: "1999-09-09" }] });
  assert.equal(d.kind, "duplicate"); assert.equal(d.matches.length, 1);
  assert.equal(warningFrom(409, { error: "visit_changed" }), null);
  assert.equal(warningFrom(400, { error: "target_has_visit_that_day" }), null);
});

test("summary names what moves, including a paid OR", () => {
  const s = movesSummary({ counts: { consultations: 1, prescriptions: 1, documents: 2, payments: 1 }, payment_status: "Paid", or_number: "OR-55", queue_number: "R-042" });
  assert.match(s, /consultation notes, prescription, uploaded files, payment \(OR OR-55\)/);
  assert.match(movesSummary({ counts: {}, payment_status: null, or_number: null, queue_number: null }), /Only the visit/);
});

test("reprinted slip escapes names and shows the queue number", () => {
  const esc = (x) => x.replace(/</g, "&lt;");
  const h = slipHtml({ queueNumber: "R-042", patientName: "<b>X", patientCode: "MF-1", date: today }, esc);
  assert.match(h, /R-042/); assert.match(h, /&lt;b>X/); assert.doesNotMatch(h, /<b>X/);
});
//JJQR - END
