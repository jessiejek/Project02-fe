import { test, expect } from "../support/fixtures";
import { cancelOwnBooking, createTaggedPatient, getDoctor, getPaymentForBooking, manilaOpenDate, registerFreshPatient } from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/**
 * finish/all — UI/API proofs for the bugs fixed in the "finish the app" run (B-xx ids from docs/FINISH-CHECKLIST.md).
 * Each test creates and removes its own data, like the rest of the suite.
 */

test.describe("B-06 / B-29 · booking page warns about days that can't be booked", () => {
  test("a date the doctor blocked shows the reason and the Book button is disabled; an open date still books", async ({ loginAs, api, tag, cleanup, guard }) => {
    guard.allow(/\/api\/bookings\/book/);
    const doc = await api("doctor");
    const d = await getDoctor(doc);
    const blockedDate = manilaOpenDate(9);
    const blk = await doc.post(`/api/doctors/${d.doctor_id}/blocked-dates`, { data: { blocked_date: blockedDate, reason: tag("b6ui") } });
    expect(blk.ok(), await blk.text()).toBeTruthy();
    const blockedId = (await blk.json()).id;
    cleanup(async () => void (await doc.delete(`/api/doctors/blocked-dates/${blockedId}`)));

    const me = await registerFreshPatient(tag("b6ui"));
    cleanup(() => me.dispose());
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    await page.getByLabel("Visit date").fill(blockedDate);
    await expect(page.getByRole("alert").filter({ hasText: /not available/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Book this day|Join today’s queue/ })).toBeDisabled();

    // another open day is fine and books THAT day (BUG-07: the UI used to send a key the API ignored, so it booked today)
    const openDate = manilaOpenDate(10 + (manilaOpenDate(10) === blockedDate ? 1 : 0));
    await page.getByLabel("Visit date").fill(openDate);
    await expect(page.getByRole("button", { name: "Book this day" })).toBeEnabled();
    await page.getByRole("button", { name: "Book this day" }).click();
    await expect(page.getByText(/You’re booked for/)).toBeVisible();
    const list = await (await me.api.get("/api/bookings/me")).json();
    for (const x of list.items ?? list) cleanup(() => cancelOwnBooking(me.api, x.booking_id));
    expect((list.items ?? list).map((x: any) => x.appointment_date)).toEqual([openDate]);
  });
});

test.describe("B-02 / B-03 · payment amount", () => {
  test("a blank, non-number, zero, negative or too-small amount shows an error and records nothing; a real amount records it", async ({ as, api, tag, cleanup, guard }) => {
    guard.off();
    const staff = await api("staff");
    const doctor = await api("doctor");
    const p = await createTaggedPatient(staff, tag("b3"));
    const v = await completeVisitViaApi({ staff, doctor }, p.patient_id);
    cleanup(() => settleViaApi(staff, v.booking_id));
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v.booking_id}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: /Record payment of/ });
    const amount = dialog.getByLabel("Amount received (₱)");
    const cases: Array<[string, RegExp]> = [
      ["", /Enter the amount/],
      ["abc", /must be a number/],
      ["0", /more than ₱0/],
      ["-50", /must be a number|more than ₱0/],
      ["10", /less than the ₱450/],
      ["99999999", /can't be more than/],
    ];
    for (const [typed, message] of cases) {
      await amount.fill(typed);
      await dialog.getByRole("button", { name: "Record payment" }).click();
      await expect(dialog.getByRole("alert")).toContainText(message);
      await expect(dialog).toBeVisible();
    }
    expect((await getPaymentForBooking(staff, v.booking_id)).status, "nothing was recorded for any bad amount").toBe("Unpaid");
    await amount.fill("500"); // cash with change is fine
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByRole("dialog", { name: "Receipt" })).toBeVisible();
    const pay = await getPaymentForBooking(staff, v.booking_id);
    expect(pay.status).toBe("Paid");
    expect(Number(pay.amount_received)).toBe(500);
  });
});
