import { test, expect } from "../support/fixtures";
import { createPatient, checkInWalkIn, getConsultationByBooking, getBooking } from "../support/api";

/**
 * Regression test for a real production bug: completing a consultation with
 * NO follow-up set did nothing — the "Confirm & Complete" click just sat
 * there. full-visit.spec.ts never caught it because it deliberately fills
 * every optional section, follow-up included, so it never exercised the
 * "delete a follow-up that was never created" code path (a 404 from the API,
 * thrown and never caught, silently killed the whole save).
 *
 * This test does the opposite on purpose: fills in ONLY the three required
 * sections (Chief Complaint, Vitals, Diagnosis) and completes immediately —
 * Follow-up, Lab Orders, Vaccinations, Prescription, and Medical Certificate
 * are all left untouched. If "Confirm & Complete" silently fails again, this
 * fails loudly instead of a real doctor discovering it.
 */
test("consultation completes with only the required fields — no follow-up, no optional sections touched", async ({ as, api }) => {
  test.setTimeout(60_000);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  const tag = Date.now().toString(36);
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });

  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation/${ticket.booking_id}`);
  await expect(doctor.getByRole("heading", { name: /SOAP & Chief Complaint/ })).toBeVisible();

  // ── 1. SOAP — only the required Chief Complaint, nothing else ───────────
  await doctor.getByPlaceholder("Chief Complaint*").fill("E2E minimal — sore throat");

  // ── 2. Vital Signs — every default field (required), then Save ──────────
  await doctor.getByRole("heading", { name: /2\. Vital Signs/ }).click();
  const bp = doctor.getByPlaceholder("Enter blood pressure");
  await expect(bp).toBeVisible();
  await bp.fill("118/76");
  await doctor.getByPlaceholder("Enter pulse rate").fill("72");
  await doctor.getByPlaceholder("Enter temperature").fill("37.0");
  await doctor.getByPlaceholder("Enter respiratory rate").fill("16");
  await doctor.getByPlaceholder("Enter o2 saturation").fill("99");
  await doctor.getByPlaceholder("Enter weight").fill("65");
  await doctor.getByPlaceholder("Enter height").fill("165");
  await doctor.getByRole("button", { name: "Save", exact: true }).click();
  await doctor.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(doctor.getByText(/Vitals saved at/)).toBeVisible();

  // ── 3. Diagnosis — one line, the minimum ─────────────────────────────────
  await doctor.getByRole("heading", { name: /3\. Diagnosis/ }).click();
  await doctor.getByPlaceholder("Diagnosis (free text)*").fill("Acute pharyngitis");
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText("Acute pharyngitis (Primary)")).toBeVisible();

  // Deliberately NOT touching: Prescription, Lab Orders, Vaccinations,
  // Follow-up, Medical Certificate, Professional Fee Decision.

  // ── Complete → checklist modal warns about no follow-up → confirm anyway ─
  await doctor.getByRole("button", { name: "Complete Consultation", exact: true }).click();
  await expect(doctor.getByText("No follow-up set — confirm this is intentional?")).toBeVisible();
  await doctor.getByRole("button", { name: "Confirm & Complete" }).click();

  // This is the exact assertion that used to hang forever — the click did
  // nothing, no error, no navigation, and this text never appeared.
  await expect(doctor.getByText("Consultation saved")).toBeVisible({ timeout: 15_000 });

  // No silent-failure error banner should have appeared along the way.
  await expect(doctor.getByText(/Could not complete the consultation/)).toHaveCount(0);

  // Server-side: actually completed, and genuinely no follow-up row exists.
  await expect
    .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status, { timeout: 15_000 })
    .toBe("Completed");
  const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
  const fu = consult.follow_ups ?? consult.follow_up ?? consult.followUp;
  expect(Array.isArray(fu) ? fu.length : fu, "no follow-up should exist").toBeFalsy();

  // Regression: the consultation row and the booking/queue row track status
  // separately. Completing the clinical record used to leave the booking
  // stuck on its old status (e.g. CheckedIn) forever, so it never surfaced
  // in staff's "Ready for Payment" list — a doctor could finish a visit and
  // it would just silently never reach the front desk.
  const booking = await getBooking(doctorApi, ticket.booking_id);
  expect(booking.status, "booking itself must also flip to Completed").toBe("Completed");
});
