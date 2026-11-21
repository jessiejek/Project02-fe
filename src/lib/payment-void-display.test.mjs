//JJQR - AI (Nov 21, 2026) - a cancelled / no-show / expired visit shows "—", never "Unpaid"
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapAppointments } from "../components/doctor/appointments/model.ts";

const row = (status, pay) => ({ booking_id: status, appointment_date: "2026-11-21", queue_number: "R-001", status, visit_type: "New", patients: { first_name: "A", last_name: "B", patient_code: "MF-1" }, payments: pay ? { status: pay } : null });

test("doctor queue: cancelled, no-show and expired show a dash instead of Unpaid", () => {
  for (const s of ["Cancelled", "NoShow", "Expired"]) {
    assert.equal(mapAppointments([row(s, "Unpaid")])[0].paymentStatus, "—", s);
  }
});

test("doctor queue: live and finished visits keep their real payment status", () => {
  assert.equal(mapAppointments([row("Completed", "Unpaid")])[0].paymentStatus, "Unpaid");
  assert.equal(mapAppointments([row("CheckedIn", "Unpaid")])[0].paymentStatus, "Unpaid");
  assert.equal(mapAppointments([row("Completed", "Paid")])[0].paymentStatus, "Paid");
  assert.equal(mapAppointments([row("Completed", null)])[0].paymentStatus, null);
});

test("doctor visit detail and consult banner use the same rule", () => {
  const detail = readFileSync(new URL("../app/doctor/appointments/[id]/page.tsx", import.meta.url), "utf8");
  const consult = readFileSync(new URL("../app/doctor/consultation2/[bookingId]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /paymentStatus: isVoidBooking\(b\.status\) \? "—" : b\.payments\?\.status \?\? "Not recorded"/);
  assert.match(consult, /paymentStatus: isVoidBooking\(bookingRow\.status\) \? "—" : bookingRow\.payments\?\.status \?\? "Not recorded"/);
});
//JJQR - END
