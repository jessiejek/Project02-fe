import { test, expect } from "../support/fixtures";
import { createPatient, checkInWalkIn, getBooking, getConsultationByBooking, getRxGroups } from "../support/api";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ARTIFACTS = join(__dirname, "..", "artifacts");

/**
 * The flagship journey — one real walk-in visit, end to end, across three roles:
 *
 *   staff   registers a new patient  →  checks them into today's queue  →  calls them in
 *   doctor  opens the consultation   →  records CC + vitals + diagnosis + a prescription  →  completes it
 *   staff   marks the queue entry complete  →  collects the payment (Cash)
 *   doctor  prints the prescription   →  we capture the print window and check the PDF
 *
 * API calls are used only for setup and for asserting server state; every
 * clinical action goes through the UI.
 */
test("walk-in visit: register → consult → pay → prescription PDF", async ({ as, api }) => {
  test.setTimeout(180_000);
  const tag = Date.now().toString(36);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  // ── setup: a fresh patient in today's queue ──────────────────────────────
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
  const patientName = `${patient.first_name} ${patient.last_name}`;
  expect(ticket.provisional_fee).toBe(450); // standard New consultation

  // ── staff: call the patient in from the queue board ──────────────────────
  const staff = await as("staff");
  await staff.goto("/staff/queue");
  const queueRow = staff.locator("tr", { hasText: ticket.queue_number });
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole("button", { name: "Call" }).click();
  await expect(queueRow.getByText("INPROGRESS")).toBeVisible();

  // ── doctor: run the consultation ────────────────────────────────────────
  const doctor = await as("doctor");
  await doctor.goto("/doctor/appointments");
  const apptRow = doctor.locator("tr", { hasText: ticket.queue_number });
  await apptRow.getByRole("button", { name: "Start Consultation" }).click();
  await expect(doctor).toHaveURL(new RegExp(`/doctor/consultation/${ticket.booking_id}`));

  // Chief Complaint
  await doctor.getByPlaceholder("Chief Complaint*").fill("E2E: sore throat and low-grade fever, 2 days");

  // Vitals — open section 2, fill BP + pulse, Save → confirm
  await doctor.getByRole("heading", { name: /2\. Vital Signs/ }).click();
  await doctor.getByPlaceholder("Enter blood pressure").fill("120/80");
  await doctor.getByPlaceholder("Enter pulse rate").fill("74");
  await doctor.getByRole("button", { name: "Save", exact: true }).first().click();
  await doctor.getByRole("button", { name: "Confirm" }).click();
  await expect(doctor.getByText(/Vitals saved at/)).toBeVisible();

  // Diagnosis — open section 3, add a free-text line
  await doctor.getByRole("heading", { name: /3\. Diagnosis/ }).click();
  await doctor.getByPlaceholder("Diagnosis (free text)*").fill("Acute viral pharyngitis");
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText("Acute viral pharyngitis (Primary)")).toBeVisible();

  // Prescription — open section 4, add one medicine
  await doctor.getByRole("heading", { name: /4\. Prescription/ }).click();
  await doctor.getByPlaceholder("Medication — pick from the list or just type it").fill("Paracetamol");
  await doctor.getByText("Will be added as typed", { exact: false }).waitFor();
  await doctor.getByPlaceholder("Dosage / strength").fill("500 mg");
  await doctor.getByPlaceholder("# Quantity (e.g. 30, 1 box)").fill("20 tablets");
  await doctor.getByRole("button", { name: "Add Item" }).click();
  await expect(doctor.getByText("Paracetamol")).toBeVisible();

  // Complete → checklist modal → confirm
  await doctor.getByRole("button", { name: "Complete Consultation" }).click();
  await doctor.getByRole("button", { name: "Confirm & Complete" }).click();

  // server: consultation recorded
  await expect
    .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status)
    .toBe("Completed");
  const rx = await getRxGroups(doctorApi, patient.patient_id);
  expect(rx.length, "prescription group persisted").toBeGreaterThan(0);
  expect(JSON.stringify(rx)).toContain("Paracetamol");

  // ── staff: finish the queue entry + collect payment ─────────────────────
  await staff.goto("/staff/queue");
  const row2 = staff.locator("tr", { hasText: ticket.queue_number });
  await row2.getByRole("button", { name: "Complete" }).click();
  await expect(row2.getByText("COMPLETED")).toBeVisible();

  await staff.goto("/staff/payments");
  const payRow = staff.locator("tr, li", { hasText: ticket.queue_number });
  await payRow.getByRole("button", { name: "Confirm Payment" }).click();
  await staff.getByRole("button", { name: "Cash", exact: true }).click();
  await staff.getByRole("button", { name: "Confirm", exact: true }).click();

  await expect
    .poll(async () => (await getBooking(staffApi, ticket.booking_id)).status)
    .toBe("Completed");

  // ── doctor: print the prescription, capture the PDF ─────────────────────
  await doctor.goto(`/doctor/patients/${patient.patient_id}`);
  const popupPromise = doctor.context().waitForEvent("page");
  await doctor.getByRole("button", { name: "Print prescription" }).click();      // opens Print Preview modal
  await doctor.getByRole("button", { name: "Print", exact: true }).click();      // fires window.print()
  const printWin = await popupPromise;
  await printWin.waitForLoadState("domcontentloaded");

  const html = await printWin.content();
  expect(html).toContain("Prescription");
  expect(html).toContain(patientName);
  expect(html).toContain("Paracetamol");
  expect(html).toContain("20 tablets");
  expect(html).toMatch(/Sig\./);

  mkdirSync(ARTIFACTS, { recursive: true });
  const pdfPath = join(ARTIFACTS, `prescription-${tag}.pdf`);
  await printWin.pdf({ path: pdfPath, format: "A4", printBackground: true });
  await test.info().attach("prescription.pdf", { path: pdfPath, contentType: "application/pdf" });
});
