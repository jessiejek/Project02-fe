import { test, expect } from "../support/fixtures";
import {
  bookOnline, cancelOwnBooking, cancelQueueEntry, checkInWalkIn, createTaggedPatient, getDoctor,
  getPaymentForBooking, getSettings, loginViaUi, manilaDate, manilaOpenDate, putSettings, registerFreshPatient,
} from "../support/api";

/**
 * COVERAGE-PLAN §2 — prove or disprove B1–B7. Each test asserts the CORRECT behaviour;
 * where the app misbehaves the test is marked test.fail(...) with the bug number so the suite
 * stays green but flips red the day the bug is fixed.
 */
const LONG = "x".repeat(5000);
/** Soft-assert that the server refused a bad payload; every accepted payload is listed in the failure. */
const bad = (label: string, res: { status(): number }) =>
  expect.soft([400, 422], `server ACCEPTED (${res.status()}) → ${label}`).toContain(res.status());

test.describe("B1 · server-side validation", () => {
  test("Patients PUT/POST reject empty names, 5000-char strings and a bad date", async ({ api, tag, guard }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off(); // we intentionally send bad payloads
    const staff = await api("staff");
    const p = await createTaggedPatient(staff, tag("b1p"));
    const put = (data: Record<string, unknown>) => staff.put(`/api/patients/${p.patient_id}`, { data: { ...p, ...data } });
    bad(`patient PUT first_name ""`, await put({ first_name: "" }));
    bad(`patient PUT last_name blank`, await put({ last_name: "   " }));
    bad(`patient PUT last_name 5000 chars`, await put({ last_name: LONG }));
    bad(`patient PUT date_of_birth 2999-01-01`, await put({ date_of_birth: "2999-01-01" }));
    bad(`patient PUT sex "Banana"`, await put({ sex: "Banana" }));
    const post = await staff.post("/api/patients", { data: { first_name: "", last_name: tag("b1post"), is_guest: true } });
    bad("POST /api/patients with empty names", post);
  });

  test("Announcements POST rejects empty title / empty message / 5000-char message", async ({ api, tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const admin = await api("admin");
    const made: string[] = [];
    cleanup(async () => { for (const id of made) await admin.delete(`/api/announcements/${id}`); });
    for (const [label, data] of [
      ["empty title", { title: "", body: "m", is_active: true }],
      ["empty body", { title: tag("b1a"), body: "", is_active: true }],
      ["5000-char body", { title: tag("b1a"), body: LONG, is_active: true }],
      ["5000-char title", { title: LONG, body: "m", is_active: true }],
    ] as const) {
      const r = await admin.post("/api/announcements", { data });
      if (r.ok()) made.push((await r.json()).id);
      bad(`announcement with ${label}`, r);
    }
  });

  test("Settings PUT rejects blank clinic name, negative fee, discount > 100%, 5000-char address @global", async ({ api, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const admin = await api("admin");
    const original = await getSettings(admin);
    cleanup(async () => void (await putSettings(admin, original)));
    for (const patch of [
      { clinic_name: "" },
      { address: LONG },
      { fee_consultation: -100 },
      { discount_pct: 5 },
      { website_url: "not a url" },
    ]) {
      const r = await putSettings(admin, { ...original, ...patch });
      bad(`settings ${JSON.stringify(patch).slice(0, 60)}`, r);
      await putSettings(admin, original); // restore immediately even if the server accepted the bad value
    }
  });

  test("StaffAccounts PUT rejects blank full name and a 5000-char contact number", async ({ api, tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const admin = await api("admin");
    const email = `${tag("b1s").toLowerCase()}@example.test`;
    const inv = await admin.post("/api/auth/invite", { data: { email, fullName: tag("b1s"), role: "Staff" } });
    expect(inv.ok(), await inv.text()).toBeTruthy();
    const { user_id: userId, staff_id: staffId } = await inv.json();
    cleanup(async () => void (await admin.delete(`/api/auth/users/${userId}`)));
    const row = (await (await admin.get("/api/staff-accounts")).json()).find((r: any) => r.staff_id === staffId);
    bad(`staff-account PUT full_name ""`, await admin.put(`/api/staff-accounts/${staffId}`, { data: { ...row, full_name: "" } }));
    bad(`staff-account PUT contact_number 5000 chars`, await admin.put(`/api/staff-accounts/${staffId}`, { data: { ...row, contact_number: LONG } }));
  });

  test("Vitals PUT rejects an unknown template id and a 5000-char value", async ({ api, tag, guard }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const staff = await api("staff");
    const p = await createTaggedPatient(staff, tag("b1v"));
    const q = await checkInWalkIn(staff, p.patient_id);
    const tpl = (await (await staff.get("/api/vital-field-templates")).json())[0].template_id;
    bad(`vitals PUT value 5000 chars`, await staff.put(`/api/vitals/by-booking/${q.booking_id}`, { data: [{ template_id: tpl, value: LONG }] }));
    bad(`vitals PUT unknown template id`, await staff.put(`/api/vitals/by-booking/${q.booking_id}`, { data: [{ template_id: "00000000-0000-0000-0000-0000000000aa", value: "120/80" }] }));
    await cancelQueueEntry(staff, q.booking_id);
  });

  test("Vaccinations POST rejects blank vaccine, 5000-char vaccine, negative dose number", async ({ api, tag, guard }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const doc = await api("doctor");
    const staff = await api("staff");
    const p = await createTaggedPatient(staff, tag("b1vac"));
    const base = { patient_id: p.patient_id, status: "Administered", source: "AdministeredInClinic", administered_date: manilaDate() };
    for (const extra of [{ vaccine_name: "" }, { vaccine_name: LONG }, { vaccine_name: "MMR", dose_number: -3 }, { vaccine_name: "MMR", expiry_date: "not-a-date" }]) {
      bad(`vaccination POST ${JSON.stringify(extra).slice(0, 50)}`, await doc.post("/api/patient-vaccinations", { data: { ...base, ...extra } }));
    }
  });

  test("LabOrders PUT rejects a blank test name and a 5000-char test name", async ({ api, tag, guard }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-01 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const staff = await api("staff");
    const doc = await api("doctor");
    const d = await getDoctor(staff);
    const p = await createTaggedPatient(staff, tag("b1lab"));
    const q = await checkInWalkIn(staff, p.patient_id);
    const c = await doc.put(`/api/consultations/by-booking/${q.booking_id}`, {
      data: { patient_id: p.patient_id, doctor_id: d.doctor_id, status: "Draft", chief_complaint: "E2E" },
    });
    expect(c.ok(), await c.text()).toBeTruthy();
    const cid = (await c.json()).consultation_id;
    bad(`lab order PUT test_name ""`, await doc.put(`/api/lab-orders/by-consultation/${cid}`, { data: [{ test_name: "" }] }));
    bad(`lab order PUT test_name 5000 chars`, await doc.put(`/api/lab-orders/by-consultation/${cid}`, { data: [{ test_name: LONG }] }));
    await doc.put(`/api/lab-orders/by-consultation/${cid}`, { data: [] }); // leave nothing behind if the bad rows were accepted
    await cancelQueueEntry(staff, q.booking_id);
  });
});

test.describe("B2 · payment AmountReceived is validated", () => {
  for (const [label, amount] of [["negative (-50)", -50], ["zero (0)", 0], ["huge (99,999,999)", 99_999_999]] as const) {
    test(`confirm with ${label} is refused`, async ({ api, tag, guard }) => {
      //JJQR - AI (Nov 20, 2026) - BUG-02 fixed: test.fail marker removed, the test must now pass //JJQR - END
      guard.off();
      const staff = await api("staff");
      const p = await createTaggedPatient(staff, tag("b2"));
      const q = await checkInWalkIn(staff, p.patient_id);
      const pay = await getPaymentForBooking(staff, q.booking_id);
      const r = await staff.post(`/api/payments/${pay.payment_id}/confirm`, { data: { payment_method: "Cash", amount_received: amount } });
      const status = r.status();
      if (status < 400) {
        // Leave the dev DB readable: record what the server accepted.
        const after = await getPaymentForBooking(staff, q.booking_id);
        console.log(`[B2] server ACCEPTED amount_received=${amount} → stored ${after.amount_received}`);
      }
      expect([400, 422], `server ACCEPTED amount_received=${amount} (status ${status})`).toContain(status);
    });
  }
});

test.describe("B3 · /staff/payments amount field", () => {
  for (const [label, typed] of [["abc", "abc"], ["0", "0"], ["-50", "-50"]] as const) {
    test(`typing "${label}" shows a validation error and records nothing`, async ({ as, api, tag, guard }) => {
      //JJQR - AI (Nov 20, 2026) - BUG-03 fixed: test.fail marker removed, the test must now pass //JJQR - END
      guard.off();
      const staff = await api("staff");
      const p = await createTaggedPatient(staff, tag("b3"));
      const q = await checkInWalkIn(staff, p.patient_id);
      // /staff/payments lists completed visits that still owe the fee.
      const done = await staff.put(`/api/queue/${q.booking_id}/complete`);
      expect(done.status()).toBeLessThan(500);
      const page = await as("staff");
      await page.goto("/staff/payments");
      const row = page.getByRole("row").filter({ hasText: p.first_name });
      await row.getByRole("button", { name: "Record payment" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel(/amount received/i).fill(typed);
      await dialog.getByRole("button", { name: "Record payment" }).click();
      await page.waitForTimeout(1200);
      const pay = await getPaymentForBooking(staff, q.booking_id);
      expect(pay.status, `a payment was recorded for input "${typed}" (amount_received=${pay.amount_received})`).toBe("Unpaid");
    });
  }
});

test.describe("B4 · review only a Completed visit", () => {
  test("API: patient reviewing their own Pending booking is refused", async ({ tag, guard, cleanup, api }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-04 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const me = await registerFreshPatient(tag("b4"));
    cleanup(() => me.dispose());
    const b = await bookOnline(me.api, manilaDate(), tag("b4n"));
    expect(b.status).toBe(201);
    cleanup(() => cancelOwnBooking(me.api, b.body.booking_id));
    const d = await getDoctor(await api("staff"));
    const r = await me.api.post("/api/reviews", { data: { booking_id: b.body.booking_id, doctor_id: d.doctor_id, patient_id: me.patientId, rating: 5, comment: tag("b4c") } });
    expect([400, 403, 409]).toContain(r.status());
  });

  test("UI: /patient/reviews/[bookingId] does not offer the form for a visit that never happened", async ({ loginAs, tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-04 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const me = await registerFreshPatient(tag("b4u"));
    cleanup(() => me.dispose());
    const b = await bookOnline(me.api, manilaDate(), tag("b4n"));
    cleanup(() => cancelOwnBooking(me.api, b.body.booking_id));
    const page = await loginAs(me.email, me.password);
    await page.goto(`/patient/reviews/${b.body.booking_id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("radiogroup", { name: "Rating" })).toHaveCount(0);
  });

  test("API: patient reviewing a Cancelled booking is refused", async ({ tag, guard, cleanup, api }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-04 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const me = await registerFreshPatient(tag("b4x"));
    cleanup(() => me.dispose());
    const b = await bookOnline(me.api, manilaDate(), tag("b4n"));
    await me.api.put(`/api/bookings/${b.body.booking_id}/cancel`, { data: { reason: "E2E" } });
    const d = await getDoctor(await api("staff"));
    const r = await me.api.post("/api/reviews", { data: { booking_id: b.body.booking_id, doctor_id: d.doctor_id, patient_id: me.patientId, rating: 5 } });
    expect([400, 403, 409]).toContain(r.status());
  });
});

test.describe("B6 · double booking the same day", () => {
  test("API: the same patient booking today twice is refused the second time", async ({ tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-05 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const me = await registerFreshPatient(tag("b6"));
    cleanup(() => me.dispose());
    const first = await bookOnline(me.api, manilaOpenDate(1), tag("b6a"));
    expect(first.status).toBe(201);
    cleanup(() => cancelOwnBooking(me.api, first.body.booking_id));
    const second = await bookOnline(me.api, manilaOpenDate(1), tag("b6b"));
    if (second.status === 201) cleanup(() => cancelOwnBooking(me.api, second.body.booking_id));
    expect([400, 409], `second booking for the same date returned ${second.status} (queue ${second.body.queue_number} vs ${first.body.queue_number})`).toContain(second.status);
  });

  test("UI: /patient/bookings refuses a second booking for the same day", async ({ loginAs, tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-05 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const me = await registerFreshPatient(tag("b6u"));
    cleanup(() => me.dispose());
    const first = await bookOnline(me.api, manilaDate(), tag("b6a"));
    cleanup(() => cancelOwnBooking(me.api, first.body.booking_id));
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    await page.getByRole("button", { name: "Join today’s queue" }).click();
    // either the success note or the server's refusal — both are a visible alert
    await expect(page.getByText(/You’re booked for/).or(page.getByRole("alert").filter({ hasText: /\S/ })).first()).toBeVisible();
    const list = await (await me.api.get("/api/bookings/me")).json();
    const open = (list.items ?? list).filter((x: any) => x.appointment_date === manilaDate() && x.status !== "Cancelled");
    for (const x of open) cleanup(() => cancelOwnBooking(me.api, x.booking_id));
    expect(open.length, "patient now holds two active bookings for the same date").toBe(1);
  });
});

test.describe("B7 · booking ignores blocked dates and closed days", () => {
  test("API: patient cannot book a date the doctor has blocked", async ({ api, tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-06 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const doc = await api("doctor");
    const d = await getDoctor(doc);
    const date = manilaOpenDate(5);
    const blk = await doc.post(`/api/doctors/${d.doctor_id}/blocked-dates`, { data: { blocked_date: date, reason: tag("b7") } });
    expect(blk.ok(), await blk.text()).toBeTruthy();
    const blockedId = (await blk.json()).id;
    cleanup(async () => void (await doc.delete(`/api/doctors/blocked-dates/${blockedId}`)));
    const me = await registerFreshPatient(tag("b7p"));
    cleanup(() => me.dispose());
    const r = await bookOnline(me.api, date, tag("b7n"));
    if (r.status === 201) cleanup(() => cancelOwnBooking(me.api, r.body.booking_id));
    expect([400, 409], `booking on a blocked date returned ${r.status}`).toContain(r.status);
  });
});

test.describe("B7b · closed weekday", () => {
  test("API: patient cannot book a weekday the doctor schedule marks closed @global", async ({ api, tag, guard, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-06 fixed: test.fail marker removed, the test must now pass //JJQR - END
    guard.off();
    const doc = await api("doctor");
    const d = await getDoctor(doc);
    const date = manilaOpenDate(6);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const sched: any[] = await (await doc.get(`/api/doctors/${d.doctor_id}/schedules`)).json();
    // The dev doctor starts with no schedule rows: give that weekday hours first, then close it; the cleanup puts it back (inactive = how it started).
    const row = sched.find((x) => x.day_of_week === dow) ?? { doctor_id: d.doctor_id, day_of_week: dow, is_active: false, start_time: "09:00:00", end_time: "17:00:00" };
    cleanup(async () => void (await doc.put(`/api/doctors/${d.doctor_id}/schedules`, { data: row })));
    //JJQR - AI (Nov 20, 2026) - B-06: a weekday is "closed" only once the doctor has a real schedule (at least one working day; all-off = nothing set up).
    // So: give the doctor a working day other than the target, then switch the target weekday off.
    const other = (dow + 1) % 7;
    const otherRow = sched.find((x) => x.day_of_week === other) ?? { doctor_id: d.doctor_id, day_of_week: other, is_active: false, start_time: "09:00:00", end_time: "17:00:00" };
    cleanup(async () => void (await doc.put(`/api/doctors/${d.doctor_id}/schedules`, { data: otherRow })));
    const workDay = await doc.put(`/api/doctors/${d.doctor_id}/schedules`, { data: { ...otherRow, is_active: true } });
    expect(workDay.ok(), await workDay.text()).toBeTruthy();
    const closed = await doc.put(`/api/doctors/${d.doctor_id}/schedules`, { data: { ...row, is_active: false } });
    expect(closed.ok(), await closed.text()).toBeTruthy();
    //JJQR - END
    const me = await registerFreshPatient(tag("b7c"));
    cleanup(() => me.dispose());
    const r = await bookOnline(me.api, date, tag("b7cn"));
    if (r.status === 201) cleanup(() => cancelOwnBooking(me.api, r.body.booking_id));
    expect([400, 409], `booking on a closed weekday returned ${r.status}`).toContain(r.status);
  });
});

// B5 (double submit) lives with each form's own tests: payments, walk-in, booking, review, announcements.
