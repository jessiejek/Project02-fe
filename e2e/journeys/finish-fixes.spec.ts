import { test, expect } from "../support/fixtures";
import { cancelOwnBooking, getDoctor, manilaOpenDate, registerFreshPatient } from "../support/api";

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
