import { test, expect } from "../support/fixtures";
import { bookOnline, cancelQueueEntry, createTaggedPatient, getBooking, getPaymentForBooking, getSettings, manilaDate, putSettings, registerFreshPatient } from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";
import { journeyOne } from "../support/journey";

/** COVERAGE-PLAN §4 · cross-role journeys */

test.describe("§4 journeys", () => {
  test("J1 · patient books → staff checks in → doctor completes → staff takes payment → patient sees record/Rx → audit log has the steps", async ({ as, loginAs, api, tag, cleanup }) => {
    await journeyOne({ as, loginAs, api, tag, cleanup } as any);
  });

  test("J2 · doctor blocks tomorrow → patient cannot book tomorrow (covered by B7 in s2-suspected-bugs.spec.ts)", async ({ api, cleanup, tag }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-06 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const doc = await api("doctor");
    const d = (await (await doc.get("/api/doctors")).json())[0];
    const blockedDate = manilaDate(3);
    const reason = tag("jblock");
    const add = await doc.post(`/api/doctors/${d.doctor_id}/blocked-dates`, { data: { doctor_id: d.doctor_id, blocked_date: blockedDate, reason } });
    expect(add.ok(), await add.text()).toBeTruthy();
    cleanup(async () => {
      const rows: any[] = await (await doc.get(`/api/doctors/${d.doctor_id}/blocked-dates`)).json();
      for (const r of rows) if (r.reason === reason) await doc.delete(`/api/doctors/blocked-dates/${r.id}`);
    });
    const staff = await api("staff");
    const me = await registerFreshPatient(tag("j2"));
    cleanup(() => me.dispose());
    const { status, body } = await bookOnline(me.api, blockedDate);
    if (body?.booking_id) cleanup(() => cancelQueueEntry(staff, body.booking_id));
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test("J3 · admin changes the standard fee → the next online booking's amount due uses it @global", async ({ api, tag, cleanup }) => {
    const admin = await api("admin");
    const staff = await api("staff");
    const orig = await getSettings(admin);
    cleanup(() => putSettings(admin, orig));
    await putSettings(admin, { ...orig, fee_consultation: 463 });
    const me = await registerFreshPatient(tag("j3"));
    cleanup(() => me.dispose());
    const { body, status } = await bookOnline(me.api, manilaDate(1));
    expect([200, 201]).toContain(status);
    cleanup(() => cancelQueueEntry(staff, body.booking_id));
    const pay = await getPaymentForBooking(staff, body.booking_id);
    expect(Number(pay.amount)).toBe(463);
  });

  test("J4 · admin publishes a new consent version → a patient who consented before is asked to consent again @global", async ({ as, loginAs, api, tag, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-37 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const admin = await api("admin");
    const orig = await getSettings(admin);
    cleanup(() => putSettings(admin, orig));
    const me = await registerFreshPatient(tag("j4"));
    cleanup(() => me.dispose());
    const pp = await loginAs(me.email, me.password);
    await pp.goto("/patient/privacy-consent");
    const box = pp.getByRole("checkbox").first();
    await box.check();
    await pp.getByRole("button", { name: /agree|accept|continue|save/i }).first().click();
    await pp.waitForTimeout(1000);
    const ap = await as("admin");
    await ap.goto("/admin/settings");
    await ap.getByRole("tab", { name: "Privacy & consent" }).click();
    await ap.getByRole("button", { name: "Publish new consent version" }).click();
    await ap.getByRole("button", { name: new RegExp(`Yes, publish v${orig.consent_version + 1}`) }).click();
    await ap.waitForTimeout(1000);
    await pp.goto("/patient/dashboard");
    await expect(pp.getByRole("link", { name: /Review consent/ })).toBeVisible({ timeout: 5000 });
  });

  test("J5 · doctor decides 'Waive' → staff can waive the fee; with no decision staff are refused", async ({ as, api, tag, cleanup, guard }) => {
    guard.allow(/\/api\/payments\/.*\/waive/);
    const staff = await api("staff");
    const doctor = await api("doctor");
    // no decision → refused
    const p1 = await createTaggedPatient(staff, tag("j5a"));
    const v1 = await completeVisitViaApi({ staff, doctor }, p1.patient_id);
    cleanup(() => settleViaApi(staff, v1.booking_id));
    const pay1 = await getPaymentForBooking(staff, v1.booking_id);
    const refused = await staff.post(`/api/payments/${pay1.payment_id}/waive`, { data: { reason: "Doctor said so" } });
    expect(refused.ok(), "waive without a doctor decision").toBeFalsy();
    // doctor Waive → allowed (UI)
    const p2 = await createTaggedPatient(staff, tag("j5b"));
    const v2 = await completeVisitViaApi({ staff, doctor }, p2.patient_id, { pfDecision: "Waive", pfReason: "E2E charity case" });
    cleanup(() => settleViaApi(staff, v2.booking_id));
    const page = await as("staff");
    await page.goto(`/staff/bookings/${v2.booking_id}`);
    await page.getByRole("button", { name: "Waive professional fee" }).click();
    const d = page.getByRole("dialog", { name: "Waive the professional fee" });
    await d.getByLabel("Reason").fill("Doctor approved the waiver");
    await d.getByRole("button", { name: "Record waiver" }).click();
    await expect.poll(async () => (await getPaymentForBooking(staff, v2.booking_id)).status, { timeout: 8000 }).toMatch(/Waived/);
  });

  test("J6 · staff marks the doctor 'Unavailable today' → doctor dashboard and the patient's doctor page both reflect it", async ({ as, loginAs, api, tag, cleanup }) => {
    const staff = await api("staff");
    const d = (await (await staff.get("/api/doctors")).json())[0];
    const setStatus = (status: string) => staff.put(`/api/doctors/${d.doctor_id}/day-status`, { data: { doctor_id: d.doctor_id, status_date: manilaDate(), status, running_late_minutes: null } });
    cleanup(() => setStatus("Available"));
    const me = await registerFreshPatient(tag("j6"));
    cleanup(() => me.dispose());
    const sp = await as("staff");
    await sp.goto("/staff/doctor-status");
    await sp.getByRole("radiogroup", { name: /Status for/ }).getByRole("radio", { name: "Out today" }).click();
    await expect.poll(async () => ((await (await staff.get(`/api/doctors/day-statuses?date=${manilaDate()}`)).json()) as any[]).find((r) => r.doctor_id === d.doctor_id)?.status).toBe("UnavailableToday");
    const dp = await as("doctor");
    await dp.goto("/doctor/dashboard");
    await expect(dp.getByRole("button", { name: "Unavailable Today", exact: true })).toHaveClass(/(^|\s)bg-primary(\s|$)/); // the selected choice is the filled (primary) button
    const pp = await loginAs(me.email, me.password);
    await pp.goto("/patient/doctors");
    await expect(pp.getByText(/Out today|Unavailable/i).first()).toBeVisible();
  });
});
void getBooking;
