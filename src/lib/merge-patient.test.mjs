//JJQR - AI (2026-11-26) - GAV-12: "Merge to existing patient" rules (merge-patient.ts)
import test from "node:test";
import assert from "node:assert/strict";
import { mergeProblem, mergeBody, activeVisitWarning, mergeToExistingSummary, mergeDoneText, mergedBannerText } from "./merge-patient.ts";

const side = (first, last, code, counts = {}) => ({ patient_id: code, patient_code: code, first_name: first, middle_name: null, last_name: last, date_of_birth: "1990-01-02", sex: "Male",
  contact_number: null, email: null, address: null, city: null, has_account: false, created_at: "2026-11-23", counts });
const keep = side("Jessie", "Rubi", "MF-1", { bookings: 1 });
const gone = side("Jese", "Rubi", "MF-2", { bookings: 1, consultations: 1 });

test("confirm needs the existing patient chosen (not this same record), no two portal accounts, and a note", () => {
  const base = { currentPatientId: "MF-2", targetId: "MF-1", note: "Same person registered twice" };
  assert.equal(mergeProblem(base), null);
  assert.match(mergeProblem({ ...base, targetId: null }), /choose the existing patient/);
  assert.match(mergeProblem({ ...base, targetId: "MF-2" }), /same record/);
  assert.match(mergeProblem({ ...base, bothHaveAccounts: true }), /portal account/);
  assert.match(mergeProblem({ ...base, note: "no" }), /at least 5/);
});

test("body keeps the picked (existing) record and merges the current one into it", () => {
  assert.deepEqual(mergeBody("MF-1", "MF-2", "  same person  "), { keep_patient_id: "MF-1", merge_patient_id: "MF-2", note: "same person" });
});

test("an open visit today is a warning (it moves and the page reloads), not a stop", () => {
  assert.equal(activeVisitWarning({ keep, merge: gone }), null);
  const w = activeVisitWarning({ keep, merge: gone, merge_active_today: [{ booking_id: "b", queue_number: "N-005", status: "InProgress" }] });
  assert.match(w, /Jese Rubi has a visit open today \(N-005\); it moves to Jessie Rubi/);
});

test("summary, done text and the retired-chart banner read plainly", () => {
  const s = mergeToExistingSummary({ keep, merge: gone });
  assert.match(s, /Jese Rubi \(MF-2\) will be merged into Jessie Rubi \(MF-1\)/);
  assert.match(s, /1 visit, 1 consultation/);
  assert.match(s, /only blank fields/);
  assert.match(mergeDoneText({ kept_patient_id: "a", kept_patient_code: "MF-1", merged_patient_id: "b", merged_patient_code: "MF-2", moved: { bookings: 1 }, filled_fields: ["Address"] }, "Jessie Rubi", "Jese Rubi"),
    /Jese Rubi \(MF-2\) is now merged into Jessie Rubi \(MF-1\). Moved: 1 visit. Filled blank fields: 1./);
  assert.equal(mergedBannerText({ patient_id: "b", patient_code: "MF-2", merged_into_patient_id: null }), null);
  assert.match(mergedBannerText({ patient_id: "b", patient_code: "MF-2", merged_into_patient_id: "a", merged_into_patient_code: "MF-1", merged_into_name: "Jessie Rubi" }), /merged into MF-1 \(Jessie Rubi\)/);
});
//JJQR - END
