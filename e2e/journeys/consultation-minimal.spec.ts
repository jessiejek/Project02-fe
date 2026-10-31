import { test, expect } from "../support/fixtures";
import { createPatient, checkInWalkIn, getConsultationByBooking, getBooking } from "../support/api";

/**
 * Minimal consultation complete path against consultation2 gates: required SOAP/vitals/diagnosis,
 * Rx disposition ("No medicines this visit"), and a follow-up date before Complete unlocks.
 */
test("consultation completes with required fields, no-meds Rx gate, and follow-up date", async ({ as, api }) => {
  test.setTimeout(60_000);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  const tag = Date.now().toString(36);
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });

  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await expect(doctor.getByRole("heading", { name: /SOAP & Chief Complaint/ })).toBeVisible();

  await doctor.getByPlaceholder("Chief Complaint*").fill("E2E minimal — sore throat");

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

  await doctor.getByRole("heading", { name: /3\. Diagnosis/ }).click();
  const dxInput = doctor.getByPlaceholder(/Diagnosis \(/);
  await dxInput.fill("Acute pharyngitis");
  const addButtons = doctor.getByRole("button", { name: "Add", exact: true });
  await (await addButtons.count()) > 1 ? addButtons.nth(1).click() : addButtons.click();
  await expect(doctor.getByText("Acute pharyngitis (Primary)")).toBeVisible();

  await doctor.getByRole("heading", { name: /4\. Prescription/ }).click();
  const noMeds = doctor.getByText(/No medicines this visit/i);
  await noMeds.click();

  await doctor.locator("h3").filter({ hasText: /Follow-up/ }).click();
  await doctor.getByRole("button", { name: "Select date" }).click();
  await doctor.getByRole("button", { name: "Today" }).click();

  await doctor.getByRole("button", { name: "Complete Consultation", exact: true }).first().click();
  await doctor.getByRole("button", { name: "Confirm & Complete" }).click();

  await expect(doctor.getByText("Consultation saved")).toBeVisible({ timeout: 15_000 });
  await expect(doctor.getByText(/Could not complete the consultation/)).toHaveCount(0);

  await expect
    .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status, { timeout: 15_000 })
    .toBe("Completed");

  const booking = await getBooking(doctorApi, ticket.booking_id);
  expect(booking.status, "booking itself must also flip to Completed").toBe("Completed");
});
