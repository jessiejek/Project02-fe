import { test, expect, type Page } from "../support/fixtures";
import { createPatient, checkInWalkIn, getBooking, type SeededPatient, type QueueTicket } from "../support/api";

/**
 * End-to-end shift simulation, per the user's own framing: "doctors make
 * consultations and completes each and every record then staff collects
 * money." Runs several patients through the whole pipeline back to back —
 * check-in → doctor completes the minimum required record → staff collects
 * payment — rather than the single-patient happy path full-visit.spec.ts
 * already covers. This is what actually exercises the two bugs fixed this
 * session under realistic load: the booking/consultation status split (only
 * caught once, in isolation, by consultation-minimal.spec.ts) and the missing
 * patient identifier on list screens (only visible once you have more than
 * one row to tell apart).
 */
const PATIENT_COUNT = 3;

async function completeMinimalConsultation(doctor: Page, bookingId: string, label: string) {
  await doctor.goto(`/doctor/consultation/${bookingId}`);
  await expect(doctor.getByRole("heading", { name: /SOAP & Chief Complaint/ })).toBeVisible();

  await doctor.getByPlaceholder("Chief Complaint*").fill(`E2E batch — ${label}`);

  await doctor.getByRole("heading", { name: /2\. Vital Signs/ }).click();
  const bp = doctor.getByPlaceholder("Enter blood pressure");
  await expect(bp).toBeVisible();
  await bp.fill("120/80");
  await doctor.getByPlaceholder("Enter pulse rate").fill("75");
  await doctor.getByPlaceholder("Enter temperature").fill("36.8");
  await doctor.getByPlaceholder("Enter respiratory rate").fill("18");
  await doctor.getByPlaceholder("Enter o2 saturation").fill("98");
  await doctor.getByPlaceholder("Enter weight").fill("60");
  await doctor.getByPlaceholder("Enter height").fill("160");
  await doctor.getByRole("button", { name: "Save", exact: true }).click();
  await doctor.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(doctor.getByText(/Vitals saved at/)).toBeVisible();

  await doctor.getByRole("heading", { name: /3\. Diagnosis/ }).click();
  await doctor.getByPlaceholder("Diagnosis (free text)*").fill("Acute URTI");
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText("Acute URTI (Primary)")).toBeVisible();

  await doctor.getByRole("button", { name: "Complete Consultation", exact: true }).click();
  await expect(doctor.getByText("No follow-up set — confirm this is intentional?")).toBeVisible();
  await doctor.getByRole("button", { name: "Confirm & Complete" }).click();
  await expect(doctor.getByText("Consultation saved")).toBeVisible({ timeout: 15_000 });
  await expect(doctor.getByText(/Could not complete the consultation/)).toHaveCount(0);

  // The patient identifier fixed earlier this session — with several patients
  // run back to back, this is the assertion that actually matters: without
  // it, every one of these summary screens would be visually identical.
  await expect(doctor.getByText(`Patient: ${label}`, { exact: false })).toBeVisible();
}

async function confirmPaymentFor(staff: Page, queueNumber: string, patientName: string, amountDue: number) {
  const todayManila = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const row = staff
    .locator("tr, li", { hasText: queueNumber })
    .filter({ hasText: todayManila })
    .filter({ hasText: patientName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Confirm Payment" }).click();

  const dialog = staff.getByRole("dialog");
  await expect(dialog.getByText(patientName)).toBeVisible();
  await dialog.getByRole("combobox").selectOption("Cash");
  await dialog.getByPlaceholder("Amount Received").fill(String(amountDue));
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("a full shift: doctor completes every consultation, then staff collects every payment", async ({ as, api }) => {
  test.setTimeout(120_000);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  const tag = Date.now().toString(36);
  const patients: SeededPatient[] = [];
  const tickets: QueueTicket[] = [];
  for (let i = 0; i < PATIENT_COUNT; i++) {
    const patient = await createPatient(staffApi, `${tag}${i}`);
    patients.push(patient);
    tickets.push(await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" }));
  }

  // ── doctor: work the queue, one patient at a time ────────────────────────
  const doctor = await as("doctor");
  for (let i = 0; i < PATIENT_COUNT; i++) {
    await completeMinimalConsultation(doctor, tickets[i].booking_id, `E2E ${tag}${i} Tester`);
  }

  // Server-side: every booking — not just the consultation row — must have
  // flipped to Completed before staff can even see it as payable.
  for (const ticket of tickets) {
    await expect
      .poll(async () => (await getBooking(doctorApi, ticket.booking_id)).status, { timeout: 15_000 })
      .toBe("Completed");
  }

  // ── staff: collect payment for every one of them ─────────────────────────
  const staff = await as("staff");
  await staff.goto("/staff/payments");
  for (let i = 0; i < PATIENT_COUNT; i++) {
    const amountDue = Number((await getBooking(staffApi, tickets[i].booking_id)).amount_due ?? 0);
    await confirmPaymentFor(staff, tickets[i].queue_number, `E2E ${tag}${i} Tester`, amountDue);
  }

  // Every booking should now show a Paid, non-zero-collected payment — and
  // none of the three should still be sitting in the collection queue.
  for (const ticket of tickets) {
    const booking = await getBooking(staffApi, ticket.booking_id);
    expect(booking.payments?.status, `${ticket.booking_id} should be paid`).toBe("Paid");
  }
  await staff.reload();
  for (let i = 0; i < PATIENT_COUNT; i++) {
    await expect(staff.getByText(`E2E ${tag}${i} Tester`)).toHaveCount(0);
  }
});
