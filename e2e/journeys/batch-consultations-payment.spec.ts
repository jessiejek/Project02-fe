import { test, expect, type Page } from "../support/fixtures";
import { createTaggedPatient, checkInWalkIn, getBooking, type SeededPatient, type QueueTicket } from "../support/api";
import { completeConsultFromUi, fillRequiredConsultFields } from "../support/consultation-flow";
import { settleViaApi } from "../support/visit";

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

//JJQR - AI (Nov 20, 2026) - batch 2: rewritten for the redesigned consultation + the "Record payment" dialog on /staff/payments
async function completeMinimalConsultation(doctor: Page, bookingId: string, label: string) {
  await doctor.goto(`/doctor/consultation2/${bookingId}`);
  await expect(doctor.getByRole("heading", { name: "Document consultation", level: 1 })).toBeVisible();
  await fillRequiredConsultFields(doctor, `E2E batch — ${label}`);
  await completeConsultFromUi(doctor);
  await expect(doctor.getByText(/Could not complete the consultation/)).toHaveCount(0);

  // The patient identifier: with several patients run back to back, this is the assertion that actually matters —
  // without it every one of these summary screens would look the same.
  await expect(doctor.getByText(`Patient: ${label}`, { exact: false })).toBeVisible();
}

async function recordPaymentFor(staff: Page, patientName: string, amountDue: number) {
  const row = staff.getByRole("row", { name: new RegExp(patientName, "i") });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Record payment" }).click();
  const dialog = staff.getByRole("dialog", { name: /Record payment of/ });
  await expect(dialog.getByLabel("Amount received (₱)")).toHaveValue(String(amountDue));
  await dialog.getByLabel("Method").selectOption("Cash");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(row).toHaveCount(0, { timeout: 15_000 });
}

test("a full shift: doctor completes every consultation, then staff collects every payment", async ({ as, api, tag, cleanup }) => {
  test.setTimeout(180_000);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  const patients: SeededPatient[] = [];
  const tickets: QueueTicket[] = [];
  for (let i = 0; i < PATIENT_COUNT; i++) {
    const patient = await createTaggedPatient(staffApi, tag(`shift${i}`));
    patients.push(patient);
    const t = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
    tickets.push(t);
    cleanup(async () => {
      await staffApi.put(`/api/queue/${t.booking_id}/complete`).catch(() => undefined);
      await settleViaApi(staffApi, t.booking_id);
    });
  }
  const labelOf = (i: number) => `${patients[i].first_name} ${patients[i].last_name}`;

  // ── doctor: work the queue, one patient at a time ────────────────────────
  const doctor = await as("doctor");
  for (let i = 0; i < PATIENT_COUNT; i++) {
    await completeMinimalConsultation(doctor, tickets[i].booking_id, labelOf(i));
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
    await recordPaymentFor(staff, patients[i].first_name, amountDue);
  }

  // Every booking should now show a Paid payment — and none should still be in the collection list.
  for (const ticket of tickets) {
    const booking = await getBooking(staffApi, ticket.booking_id);
    expect(booking.payments?.status, `${ticket.booking_id} should be paid`).toBe("Paid");
  }
  await staff.reload();
  for (let i = 0; i < PATIENT_COUNT; i++) {
    await expect(staff.getByText(patients[i].first_name)).toHaveCount(0);
  }
});
//JJQR - END
