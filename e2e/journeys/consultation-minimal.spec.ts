import { test, expect } from "../support/fixtures";
import { createTaggedPatient, checkInWalkIn, getConsultationByBooking, getBooking } from "../support/api";
import { completeConsultFromUi, fillRequiredConsultFields } from "../support/consultation-flow";
import { settleViaApi } from "../support/visit";

//JJQR - AI (Nov 20, 2026) - batch 2: rewritten for the redesigned consultation screen
/**
 * Minimal consultation complete path against the current gates: Chief complaint, vitals (BP + pulse), a diagnosis,
 * Rx disposition ("No medicines this visit"), and the follow-up decision ("No follow-up" + its confirm tick) before Complete unlocks.
 */
test("consultation completes with required fields, no-meds Rx gate, and the follow-up decision", async ({ as, api, tag, cleanup }) => {
  test.setTimeout(90_000);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  const patient = await createTaggedPatient(staffApi, tag("min"));
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
  cleanup(async () => {
    await staffApi.put(`/api/queue/${ticket.booking_id}/complete`).catch(() => undefined);
    await settleViaApi(staffApi, ticket.booking_id);
  });

  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await expect(doctor.getByRole("heading", { name: "Document consultation", level: 1 })).toBeVisible();
  // locked until every required step is done
  await expect(doctor.getByRole("button", { name: "Complete Consultation" })).toBeDisabled();

  await fillRequiredConsultFields(doctor, "E2E minimal — sore throat");
  await completeConsultFromUi(doctor);
  await expect(doctor.getByText(/Could not complete the consultation/)).toHaveCount(0);

  await expect
    .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status, { timeout: 15_000 })
    .toBe("Completed");

  const booking = await getBooking(doctorApi, ticket.booking_id);
  expect(booking.status, "booking itself must also flip to Completed").toBe("Completed");
});
//JJQR - END
