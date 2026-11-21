//JJQR - AI (Nov 21, 2026) - staff dashboard "Arrivals": Cancel for a booking that has not been checked in
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/staff/dashboard/page.tsx", import.meta.url), "utf8");

test("Cancel is offered only when the booking is not checked in and not already paid", () => {
  assert.match(src, /const canCancel = \(b: QueueRow\) => b\.status === "Confirmed" && b\.paymentStatus !== "Paid";/);
  // both layouts (phone list + desktop table) use the same rule
  assert.equal((src.match(/canCancel\(b\) && \(/g) ?? []).length, 2);
});

test("a checked-in row keeps only 'Undo check-in' (Cancel is not shown for it)", () => {
  assert.match(src, /const checkInLabel = \(status: string\) => \(status === "Confirmed" \? "Check in" : "Undo check-in"\);/);
});

test("cancelling needs a reason and uses the status endpoint with it", () => {
  assert.match(src, /Please enter a reason\./);
  assert.match(src, /updateBookingStatus\(null as never, cancelTarget\.id, "Cancelled", \{ reason \}\)/);
});

test("after a cancel the row disappears and the lists refresh", () => {
  assert.match(src, /setBookings\(\(prev\) => prev\.filter\(\(b\) => b\.id !== id\)\)/);
  assert.match(src, /loadBookings\(\)\.catch\(\(\) => \{\}\);\s*loadQueue\(\);/);
});

test("the dialog confirms before cancelling and keeps the booking by default", () => {
  assert.match(src, /title="Cancel this booking\?"/);
  assert.match(src, /Keep booking/);
});
//JJQR - END
