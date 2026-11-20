import { test, expect } from "../support/fixtures";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  bookOnline, cancelQueueEntry, createTaggedPatient, getBooking, getPaymentForBooking, manilaDate, registerFreshPatient, checkInWalkIn,
} from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/** COVERAGE-PLAN §3 · Staff: booking detail (/staff/bookings/[id]) and payments (/staff/payments) */

type Ctx = { api: (r: "staff" | "doctor") => Promise<APIRequestContext>; tag: (l?: string) => string; cleanup: (f: () => unknown) => void };

/** A tagged patient with a finished, still-unpaid visit (amount due ₱450). */
async function unpaidVisit({ api, tag, cleanup }: Ctx, label: string) {
  const staff = await api("staff");
  const doctor = await api("doctor");
  const name = tag(label);
  const p = await createTaggedPatient(staff, name);
  const v = await completeVisitViaApi({ staff, doctor }, p.patient_id);
  cleanup(() => settleViaApi(staff, v.booking_id));
  return { staff, name, fullName: `${name} Tester`, p, bookingId: v.booking_id };
}

/** A Confirmed (booked, awaiting arrival) booking for today. */
async function confirmedBooking({ api, tag, cleanup }: Ctx, label: string) {
  const staff = await api("staff");
  const me = await registerFreshPatient(tag(label));
  cleanup(() => me.dispose());
  const { body, status } = await bookOnline(me.api, manilaDate());
  expect([200, 201]).toContain(status);
  cleanup(() => cancelQueueEntry(staff, body.booking_id));
  const up = await staff.put(`/api/bookings/${body.booking_id}/status`, { data: { status: "Confirmed" } });
  expect(up.ok(), await up.text()).toBeTruthy();
  return { staff, me, bookingId: body.booking_id as string };
}

const payDialog = (page: Page) => page.getByRole("dialog", { name: /Record payment of/ });

test.describe("/staff/bookings/[id] · record payment", () => {
  test("happy path: Cash, prefilled amount → receipt → status Paid, and it survives a reload", async ({ as, tag, api, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-ok");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await expect(page.getByText("Unpaid").first()).toBeVisible();
    await page.getByRole("button", { name: "Record payment" }).click();
    const d = payDialog(page);
    await expect(d.getByLabel("Amount received (₱)")).toHaveValue("450");
    await expect(d.getByLabel("Method")).toHaveValue("Cash");
    await d.getByLabel("Notes (optional)").fill("E2E note");
    await d.getByRole("button", { name: "Record payment" }).click();
    const receipt = page.getByRole("dialog", { name: "Receipt" });
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText(/OR /);
    await expect(receipt).toContainText("₱450");
    await receipt.getByRole("button", { name: "Close" }).last().click();
    const pay = await getPaymentForBooking(v.staff, v.bookingId);
    expect(pay).toMatchObject({ status: "Paid", payment_method: "Cash", confirm_notes: "E2E note" });
    expect(Number(pay.amount_received)).toBe(450);
    expect(pay.or_number).toBeTruthy();
    await page.reload();
    await expect(page.getByText("Paid").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "View receipt" })).toBeVisible();
  });

  test("every payment method is offered and the chosen one is stored", async ({ as, tag, api, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-m");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    const m = payDialog(page).getByLabel("Method");
    await expect(m.locator("option")).toHaveText(["Cash", "GCash", "Maya", "Bank transfer"]);
    await m.selectOption("GCash");
    await payDialog(page).getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByRole("dialog", { name: "Receipt" })).toBeVisible();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).payment_method).toBe("GCash");
  });

  test("the reference number typed in the dialog is saved with the payment", async ({ as, tag, api, cleanup }) => {
    test.fail(true, "BUG-18: /staff/bookings/[id] never sends the Reference number to the API (the /staff/payments page does)");
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-ref");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    await payDialog(page).getByLabel("Method").selectOption("GCash");
    await payDialog(page).getByLabel("Reference number (optional)").fill("GC-E2E-12345");
    await payDialog(page).getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByRole("dialog", { name: "Receipt" })).toBeVisible();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).reference_number).toBe("GC-E2E-12345");
  });

  test("after a reload, 'View receipt' still shows the real method and amount paid", async ({ as, tag, api, cleanup }) => {
    test.fail(true, "BUG-19: the receipt is built from page state, so after a reload it shows the default method (Cash) and no reference, not what was recorded");
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-rcpt");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    await payDialog(page).getByLabel("Method").selectOption("Maya");
    await payDialog(page).getByRole("button", { name: "Record payment" }).click();
    await page.getByRole("dialog", { name: "Receipt" }).getByRole("button", { name: "Close" }).last().click();
    await page.reload();
    await page.getByRole("button", { name: "View receipt" }).click();
    const r = page.getByRole("dialog", { name: "Receipt" });
    await expect(r).toContainText("Maya");
    await expect(r).toContainText("₱450");
  });

  test("Back leaves the booking unpaid and nothing is recorded", async ({ as, tag, api, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-back");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    await payDialog(page).getByLabel("Amount received (₱)").fill("123");
    await payDialog(page).getByRole("button", { name: "Back" }).click();
    await expect(payDialog(page)).toBeHidden();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).status).toBe("Unpaid");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(payDialog(page).getByLabel("Amount received (₱)")).toHaveValue("123"); // typed value is kept, not recorded
  });

  test("a negative or too-small amount is not accepted as full payment", async ({ as, tag, api, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-20 fixed: test.fail marker removed, the test must now pass //JJQR - END
    for (const bad of ["-50", "10"]) {
      const v = await unpaidVisit({ api, tag, cleanup }, "pay-bad");
      const page = await as("staff");
      await page.goto(`/staff/bookings/${v.bookingId}`);
      await page.getByRole("button", { name: "Record payment" }).click();
      await payDialog(page).getByLabel("Amount received (₱)").fill(bad);
      await payDialog(page).getByRole("button", { name: "Record payment" }).click();
      await page.waitForTimeout(700);
      const pay = await getPaymentForBooking(v.staff, v.bookingId);
      expect.soft(pay.status === "Paid" && Number(pay.amount_received) < 450, `amount "${bad}" was recorded as Paid (received ${pay.amount_received})`).toBe(false);
    }
  });

  test("double-click on 'Record payment' records exactly one payment, no error shown (B5)", async ({ as, tag, api, cleanup, guard }) => {
    guard.allow(/\/api\/payments\/.*\/confirm/);
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-dbl");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    await payDialog(page).getByRole("button", { name: "Record payment" }).dblclick();
    await expect(page.getByRole("dialog", { name: "Receipt" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
    const pay = await getPaymentForBooking(v.staff, v.bookingId);
    expect(pay.status).toBe("Paid");
    expect(Number(pay.amount_received)).toBe(450);
  });

  test("paying a second time through the API is rejected (no double payment)", async ({ tag, api, cleanup }) => {
    test.fail(true, "BUG-21: POST /api/payments/{id}/confirm succeeds again on an already-Paid payment (overwrites OR number/amount)");
    const v = await unpaidVisit({ api, tag, cleanup }, "pay-twice");
    const pay = await getPaymentForBooking(v.staff, v.bookingId);
    const body = { payment_method: "Cash", amount_received: 450, or_number: `E2E-${tag("or")}`, confirm_notes: null, reference_number: null };
    expect((await v.staff.post(`/api/payments/${pay.payment_id}/confirm`, { data: body })).ok()).toBeTruthy();
    const again = await v.staff.post(`/api/payments/${pay.payment_id}/confirm`, { data: { ...body, or_number: `E2E-${tag("or")}` } });
    expect(again.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("/staff/bookings/[id] · waive professional fee", () => {
  test("'Record waiver' needs a reason of 5+ characters; front desk is refused unless the doctor approved it", async ({ as, tag, api, cleanup, guard }) => {
    guard.allow(/\/api\/payments\/.*\/waive/);
    const v = await unpaidVisit({ api, tag, cleanup }, "waive");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Waive professional fee" }).click();
    const d = page.getByRole("dialog", { name: "Waive the professional fee" });
    const go = d.getByRole("button", { name: "Record waiver" });
    await expect(go).toBeDisabled();
    await d.getByLabel("Reason").fill("1234");
    await expect(go).toBeDisabled();
    await d.getByLabel("Reason").fill("Doctor said so");
    await expect(go).toBeEnabled();
    await go.click();
    await expect(d.getByRole("alert")).toBeVisible();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).status).toBe("Unpaid");
    await d.getByRole("button", { name: "Back" }).click();
    await expect(d).toBeHidden();
  });
});

test.describe("/staff/bookings/[id] · actions on a booked patient", () => {
  test("Check in → 'Undo check-in' → back to Confirmed", async ({ as, tag, api, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-ci");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Check in" }).click();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("CheckedIn");
    await expect(page.getByRole("button", { name: "Undo check-in" })).toBeVisible();
    await page.getByRole("button", { name: "Undo check-in" }).click();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
  });

  test("Mark no-show: Back changes nothing; confirming with a reason records it", async ({ as, tag, api, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-ns");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Mark no-show" }).click();
    const d = page.getByRole("dialog", { name: "Mark as no-show?" });
    await d.getByLabel(/Reason/).fill("never came");
    await d.getByRole("button", { name: "Back" }).click();
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
    await page.getByRole("button", { name: "Mark no-show" }).click();
    await d.getByLabel(/Reason/).fill("E2E never came");
    await d.getByRole("button", { name: "Mark no-show" }).dblclick();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("NoShow");
    await page.reload();
    await expect(page.getByText("No-show").first()).toBeVisible();
  });

  test("the reason typed for a no-show is stored on the booking", async ({ as, tag, api, cleanup }) => {
    test.fail(true, "BUG-22: the no-show reason is accepted by the dialog but never stored (cancellation_reason stays null)");
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-nsr");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Mark no-show" }).click();
    const d = page.getByRole("dialog", { name: "Mark as no-show?" });
    await d.getByLabel(/Reason/).fill("E2E never came");
    await d.getByRole("button", { name: "Mark no-show" }).click();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("NoShow");
    expect((await getBooking(b.staff, b.bookingId)).cancellation_reason).toBe("E2E never came");
  });

  test("Cancel booking: reason ≥ 5 characters; 'Keep booking' changes nothing; confirming persists after reload", async ({ as, tag, api, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-can");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const d = page.getByRole("dialog", { name: "Cancel this booking?" });
    const confirm = d.getByRole("button", { name: "Cancel booking" });
    await expect(confirm).toBeDisabled();
    await d.getByLabel("Reason").fill("abcd");
    await expect(confirm).toBeDisabled();
    await d.getByLabel("Reason").fill("E2E patient rang to cancel");
    await d.getByRole("button", { name: "Keep booking" }).click();
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await d.getByLabel("Reason").fill("E2E patient rang to cancel");
    await confirm.dblclick();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("Cancelled");
    expect((await getBooking(b.staff, b.bookingId)).cancellation_reason).toBe("E2E patient rang to cancel");
    await page.reload();
    await expect(page.getByText("Cancelled").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in" })).toHaveCount(0);
  });

  const dayLabel = (offset: number) =>
    new Date(`${manilaDate(offset)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  async function openPicker(page: Page) {
    await page.getByRole("button", { name: "Reschedule" }).click();
    const d = page.getByRole("dialog", { name: "Reschedule Booking" });
    await d.getByRole("button", { name: /^[A-Z][a-z]{2} \d+, \d{4}$/ }).click();
    await expect(page.getByRole("dialog", { name: "Choose a date" })).toBeVisible();
    await page.waitForTimeout(300); // the popover settles; an instant click reads as an outside-click and closes the modal
    return d;
  }

  test("Reschedule to tomorrow creates the new booking and the old one becomes Rescheduled", async ({ as, tag, api, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-rs");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    const d = await openPicker(page);
    await page.getByRole("button", { name: dayLabel(1), exact: true }).click();
    await d.getByRole("textbox", { name: /Reason/ }).fill("E2E moved"); // placeholder-only field: no <label> (a11y, see report)
    await d.getByRole("button", { name: "Confirm Reschedule" }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/staff/bookings/") && !u.pathname.endsWith(b.bookingId));
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Rescheduled");
    const newId = page.url().split("/").pop()!;
    cleanup(() => cancelQueueEntry(b.staff, newId));
    expect((await getBooking(b.staff, newId)).appointment_date).toBe(manilaDate(1));
  });

  test("Reschedule to a past day is refused with a message and changes nothing", async ({ as, tag, api, cleanup, guard }) => {
    guard.allow(/\/reschedule/);
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-rsp");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    const d = await openPicker(page);
    await page.getByRole("button", { name: dayLabel(-1), exact: true }).click({ force: true });
    await d.getByRole("button", { name: "Confirm Reschedule" }).click();
    await expect(d.getByText(/Cannot reschedule to a past date/)).toBeVisible();
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
  });

  test("the Reschedule calendar does not offer past days", async ({ as, tag, api, cleanup }) => {
    test.fail(true, "BUG-23: the Reschedule date picker lets staff select yesterday (only the server refuses it, after Confirm)");
    const b = await confirmedBooking({ api, tag, cleanup }, "bd-rsd");
    const page = await as("staff");
    await page.goto(`/staff/bookings/${b.bookingId}`);
    await openPicker(page);
    await expect(page.getByRole("button", { name: dayLabel(-1), exact: true })).toBeDisabled();
  });

  test("an online booking that has not arrived (Pending) opens with its details and a way back to the queue", async ({ as, tag, api, cleanup }) => {
    const staff = await api("staff");
    const me = await registerFreshPatient(tag("bd-pend"));
    cleanup(() => me.dispose());
    const { body } = await bookOnline(me.api, manilaDate());
    cleanup(() => cancelQueueEntry(staff, body.booking_id));
    const page = await as("staff");
    await page.goto(`/staff/bookings/${body.booking_id}`);
    await expect(page.getByText("Pending").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Patient", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Today.s queue/ })).toHaveAttribute("href", "/staff/queue");
  });

  test("an unknown booking id shows the not-found page", async ({ as, guard }) => {
    guard.allow(/\/api\/bookings\/0000/);
    const page = await as("staff");
    const res = await page.goto("/staff/bookings/00000000-0000-0000-0000-000000000abc");
    await expect(page.getByText(/not found|couldn.t find|doesn.t exist|404/i).first()).toBeVisible();
    void res;
  });
});

test.describe("/staff/payments", () => {
  const rowOf = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name, "i") });

  test("a finished unpaid visit is listed with its amount; recording a payment removes it, saves method + reference, and shows a confirmation", async ({ as, tag, api, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "pp-ok");
    const page = await as("staff");
    await page.goto("/staff/payments");
    const row = rowOf(page, v.name);
    await expect(row).toContainText("₱450");
    await row.getByRole("button", { name: "Record payment" }).click();
    const d = payDialog(page);
    await expect(d.getByLabel("Amount received (₱)")).toHaveValue("450");
    await d.getByLabel("Method").selectOption("GCash");
    await d.getByLabel("Reference number (optional)").fill("GC-PP-777");
    await d.getByLabel("Notes (optional)").fill("E2E payments page");
    await d.getByRole("button", { name: "Record payment" }).dblclick();
    await expect(row).toHaveCount(0);
    await expect(page.getByText(/₱450 recorded for/i)).toBeVisible();
    const pay = await getPaymentForBooking(v.staff, v.bookingId);
    expect(pay).toMatchObject({ status: "Paid", payment_method: "GCash", reference_number: "GC-PP-777", confirm_notes: "E2E payments page" });
    await page.reload();
    await expect(rowOf(page, v.name)).toHaveCount(0);
  });

  test("Back closes the dialog and the visit stays in the list, unpaid", async ({ as, tag, api, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "pp-back");
    const page = await as("staff");
    await page.goto("/staff/payments");
    await rowOf(page, v.name).getByRole("button", { name: "Record payment" }).click();
    await payDialog(page).getByRole("button", { name: "Back" }).click();
    await expect(payDialog(page)).toBeHidden();
    await expect(rowOf(page, v.name)).toBeVisible();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).status).toBe("Unpaid");
  });

  test("'Waiting to pay' counts the new unpaid visit", async ({ as, tag, api, cleanup }) => {
    const staff = await api("staff");
    const page0 = await as("staff");
    await page0.goto("/staff/payments");
    const tile = page0.locator("dt", { hasText: /^Waiting to pay$/ }).locator("xpath=..").locator("dd");
    await expect(tile).toHaveText(/^\d+$/);
    const before = Number(await tile.textContent());
    const v = await unpaidVisit({ api, tag, cleanup }, "pp-count");
    await page0.reload();
    await expect(tile).toHaveText(String(before + 1));
    void staff; void v;
  });

  test("a bad amount on the payments page is not recorded as a full payment", async ({ as, tag, api, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-20 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const v = await unpaidVisit({ api, tag, cleanup }, "pp-bad");
    const page = await as("staff");
    await page.goto("/staff/payments");
    await rowOf(page, v.name).getByRole("button", { name: "Record payment" }).click();
    await payDialog(page).getByLabel("Amount received (₱)").fill("-50");
    await payDialog(page).getByRole("button", { name: "Record payment" }).click();
    await page.waitForTimeout(700);
    const pay = await getPaymentForBooking(v.staff, v.bookingId);
    expect(pay.status === "Paid" && Number(pay.amount_received) < 450, `recorded as Paid with ₱${pay.amount_received}`).toBe(false);
  });
});

void checkInWalkIn;
