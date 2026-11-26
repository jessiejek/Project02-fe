//JJQR - AI (2026-11-26) - GAV-10: the doctor's "Edit details" dialog rules (patient-edit.ts)
import test from "node:test";
import assert from "node:assert/strict";
import { formFromPatient, patchFromForm, ageOn, patientEditProblem, titleCase, displayName } from "./patient-edit.ts";

const row = {
  first_name: "Ana", middle_name: null, last_name: "Cruz", date_of_birth: "1990-05-10", sex: "Female",
  civil_status: "Single", contact_number: "09170000000", address: "1 Fake St", city: null, zip_code: null,
  blood_type: "O+", philhealth_number: null, hmo_provider: null, hmo_card_number: null,
  emergency_contact_name: null, emergency_contact_number: null, emergency_contact_relationship: null,
};

test("form round-trips every PUT field; blanks go back as null, names are title-cased", () => {
  const f = formFromPatient(row);
  assert.equal(f.middleName, "");
  f.firstName = "  maria clara ";
  f.middleName = "dela";
  f.city = "   ";
  const p = patchFromForm(f);
  assert.equal(p.first_name, "Maria Clara");
  assert.equal(p.middle_name, "Dela");
  assert.equal(p.city, null);
  assert.equal(p.sex, "Female");
  assert.deepEqual(Object.keys(p).sort(), [
    "address", "blood_type", "city", "civil_status", "contact_number", "date_of_birth", "emergency_contact_name",
    "emergency_contact_number", "emergency_contact_relationship", "first_name", "hmo_card_number", "hmo_provider",
    "last_name", "middle_name", "philhealth_number", "sex", "zip_code",
  ]);
  // fields the PUT ignores are never sent from this dialog
  for (const k of ["email", "senior_id_number", "pwd_id_number", "guardian_name"]) assert.ok(!(k in p));
});

test("age is worked out from the birthday (Manila today), birthday not yet reached this year", () => {
  assert.equal(ageOn("1990-05-10", "2026-11-26"), 36);
  assert.equal(ageOn("1990-11-27", "2026-11-26"), 35);
  assert.equal(ageOn("1990-11-26", "2026-11-26"), 36);
  assert.equal(ageOn("2027-01-01", "2026-11-26"), null);
  assert.equal(ageOn("", "2026-11-26"), null);
});

test("refuses what the API would refuse", () => {
  const ok = formFromPatient(row);
  assert.equal(patientEditProblem(ok, "2026-11-26"), null);
  assert.equal(patientEditProblem({ ...ok, firstName: " " }, "2026-11-26").field, "firstName");
  assert.equal(patientEditProblem({ ...ok, lastName: "" }, "2026-11-26").field, "lastName");
  assert.match(patientEditProblem({ ...ok, dateOfBirth: "2026-11-27" }, "2026-11-26").message, /future/);
  assert.equal(patientEditProblem({ ...ok, dateOfBirth: "1899-12-31" }, "2026-11-26").field, "dateOfBirth");
  assert.equal(patientEditProblem({ ...ok, contactNumber: "abc" }, "2026-11-26").field, "contactNumber");
  assert.equal(patientEditProblem({ ...ok, contactNumber: "12345" }, "2026-11-26").field, "contactNumber");
  assert.equal(patientEditProblem({ ...ok, emergencyContactNumber: "x1" }, "2026-11-26").field, "emergencyContactNumber");
  assert.match(patientEditProblem({ ...ok, address: "a".repeat(301) }, "2026-11-26").message, /max 300/);
  assert.equal(patientEditProblem({ ...ok, contactNumber: "+63 917 000 0000" }, "2026-11-26"), null);
});

test("title case matches the admin dialog; header name is First Last", () => {
  assert.equal(titleCase("o'NEIL-smith jr"), "O'Neil-Smith Jr");
  assert.equal(displayName({ firstName: "juan", lastName: "dela cruz" }), "Juan Dela Cruz");
});
