import { test, expect } from "../support/fixtures";
import {
  PASSWORD, bookOnline, cancelOwnBooking, getPaymentForBooking, manilaDate, registerFreshPatient,
  type FreshPatient,
} from "../support/api";
import { completeVisitViaApi } from "../support/visit";

/** COVERAGE-PLAN §3 · Patient: privacy-consent, profile, doctors, bookings, booking detail, reviews */

type Fx = { tag: (l?: string) => string; cleanup: (fn: () => unknown) => void };
async function newPatient({ tag, cleanup }: Fx, label: string, over: Record<string, unknown> = {}): Promise<FreshPatient> {
  const me = await registerFreshPatient(tag(label), over);
  cleanup(() => me.dispose());
  return me;
}

test.describe("/patient/privacy-consent", () => {
  test("Agree is disabled until the box is ticked; agreeing records the current consent version", async ({ loginAs, api, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "consent");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/privacy-consent");
    const agree = page.getByRole("button", { name: "Agree and continue" });
    await expect(agree).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(agree).toBeEnabled();
    await page.getByRole("checkbox").uncheck();
    await expect(agree).toBeDisabled();
    await page.getByRole("checkbox").check();
    await agree.click();
    await expect(page).toHaveURL(/\/patient\/dashboard/);
    const settings = await (await (await api("admin")).get("/api/settings")).json();
    const mine = await (await me.api.get("/api/patients/me")).json();
    expect(mine.consent_version).toBe(settings.consent_version);
    expect(mine.consented_at).toBeTruthy();
  });

  test("a registered patient already has consent: no consent banner on the dashboard", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "noban");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
    await expect(page.getByText("Please review how the clinic uses your information.")).toHaveCount(0);
  });
});

test.describe("/patient/profile", () => {
  test("save every field → reload → every field persisted", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "prof");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    const vals: Record<string, string> = {
      "Middle name": "Mid", "Civil status": "Single", "Blood type": "O+", "Contact number": "09171234567",
      Address: "12 E2E Street", City: "Cebu", "ZIP code": "6000",
      Name: "Emergency Person", Relationship: "Sibling", Phone: "09179998888",
      "HMO provider": "MediCare", "HMO card number": "HMO-123", "PhilHealth number": "12-345678901-2",
    };
    for (const [label, v] of Object.entries(vals)) await page.getByLabel(label, { exact: true }).fill(v);
    await page.getByLabel("Sex").selectOption("Male");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Profile saved at/)).toBeVisible();
    await page.reload();
    for (const [label, v] of Object.entries(vals)) await expect(page.getByLabel(label, { exact: true }), label).toHaveValue(v);
    await expect(page.getByLabel("Sex")).toHaveValue("Male");
    const api = await (await me.api.get("/api/patients/me")).json();
    expect(api).toMatchObject({ middle_name: "Mid", city: "Cebu", zip_code: "6000", hmo_provider: "MediCare", emergency_contact_name: "Emergency Person" });
  });

  test('first name / last name empty → "First name is required." / "Last name is required."', async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "profreq");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByLabel("First name").fill("");
    await page.getByLabel("Last name").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Last name is required.")).toBeVisible();
    await page.getByLabel("First name").fill("   ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("First name is required.")).toBeVisible();
    const mine = await (await me.api.get("/api/patients/me")).json();
    expect(mine.first_name, "an invalid save must not change the stored name").toBe(me.firstName);
  });

  for (const bad of ["12345", "abcdefghij", "0917-12"]) {
    test(`bad phone "${bad}" → validation message, nothing saved`, async ({ loginAs, tag, cleanup }) => {
      const me = await newPatient({ tag, cleanup }, "profph");
      const page = await loginAs(me.email, me.password);
      await page.goto("/patient/profile");
      await page.getByLabel("Contact number").fill(bad);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Enter a valid phone number (at least 10 digits).")).toBeVisible();
      const mine = await (await me.api.get("/api/patients/me")).json();
      expect(mine.contact_number).toBe("09171112222");
    });
  }

  test("very long address (2,000 chars) does not crash the page (no 5xx) and reloads cleanly", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "proflong");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByLabel("Address").fill("x".repeat(2000));
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Profile saved at/).or(page.getByRole("alert").filter({ hasText: /\S/ }))).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
  });

  test("cancel = no change: edit, leave, come back → original values", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "profcx");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByLabel("City").fill("Should not persist");
    await page.getByLabel("First name").fill("Nope");
    await page.goto("/patient/dashboard");
    await page.goto("/patient/profile");
    await expect(page.getByLabel("City")).toHaveValue("");
    await expect(page.getByLabel("First name")).toHaveValue(me.firstName);
  });

  test("double submit (click + Enter) saves once without error", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "profdbl");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    let puts = 0;
    page.on("request", (r) => r.method() === "PUT" && /\/api\/patients\//.test(r.url()) && puts++);
    await page.getByLabel("City").fill("Mandaue");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByLabel("City").press("Enter");
    await expect(page.getByText(/Profile saved at/)).toBeVisible();
    expect(puts).toBeLessThanOrEqual(2);
    expect((await (await me.api.get("/api/patients/me")).json()).city).toBe("Mandaue");
  });

  test("Password tab: wrong current password is refused; mismatch / <6 chars keep the button disabled", async ({ loginAs, tag, cleanup, guard }) => {
    guard.allow(/4\d\d POST \/api\/(session|auth)\//);
    const me = await newPatient({ tag, cleanup }, "pw");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByRole("tab", { name: "Password" }).click();
    const update = page.getByRole("button", { name: "Update password" });
    await expect(update).toBeDisabled();
    await page.getByLabel("Current password").fill("Wrong-Current-1");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password").fill("short");
    await expect(update, "5-char password").toBeDisabled();
    await page.getByLabel("New password", { exact: true }).fill("Longer-Pass-1");
    await page.getByLabel("Confirm new password").fill("Different-Pass-2");
    await expect(page.getByText("Passwords don’t match yet.")).toBeVisible();
    await expect(update).toBeDisabled();
    await page.getByLabel("Confirm new password").fill("Longer-Pass-1");
    await expect(update).toBeEnabled();
    await update.click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
    // old password still works
    const ok = await (await import("@playwright/test")).request.newContext({ baseURL: process.env.E2E_BE_URL ?? "http://127.0.0.1:5055" });
    expect((await ok.post("/api/auth/login", { data: { email: me.email, password: PASSWORD } })).status()).toBe(200);
    await ok.dispose();
  });

  test("Password tab: happy path changes the password (new works, old stops working)", async ({ loginAs, tag, cleanup, guard }) => {
    guard.allow(/401 POST \/api\/auth\/login/);
    const me = await newPatient({ tag, cleanup }, "pw2");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByRole("tab", { name: "Password" }).click();
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill("New-Passw0rd!x");
    await page.getByLabel("Confirm new password").fill("New-Passw0rd!x");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Password updated. Use it the next time you sign in.")).toBeVisible();
    const { request } = await import("@playwright/test");
    const c = await request.newContext({ baseURL: process.env.E2E_BE_URL ?? "http://127.0.0.1:5055" });
    expect((await c.post("/api/auth/login", { data: { email: me.email, password: "New-Passw0rd!x" } })).status()).toBe(200);
    expect((await c.post("/api/auth/login", { data: { email: me.email, password: PASSWORD } })).status()).toBe(401);
    await c.dispose();
  });
});

test.describe("/patient/doctors", () => {
  test("list → doctor page shows name, specialty, rating, reviews and a Book a visit link", async ({ as }) => {
    const page = await as("patient");
    await page.goto("/patient/doctors");
    await expect(page).toHaveURL(/\/patient\/doctors\/[0-9a-f-]{36}/); // single-doctor clinic: the list goes straight to the doctor
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What patients say" })).toBeVisible();
    await page.getByRole("link", { name: "Book a visit" }).click();
    await expect(page).toHaveURL(/\/patient\/bookings/);
  });

  test("an unknown doctor id shows a not-found page, not a crash", async ({ as, guard }) => {
    guard.allow(/\/api\/doctors\//);
    const page = await as("patient");
    const res = await page.goto("/patient/doctors/00000000-0000-0000-0000-000000000001");
    await expect(page.getByText("Application error")).toHaveCount(0);
    expect(res?.status() ?? 200).toBeLessThan(500);
  });
});

test.describe("/patient/bookings", () => {
  test("Visit date has min = today; the button reads Join today’s queue / Book this day", async ({ as }) => {
    const page = await as("patient");
    await page.goto("/patient/bookings");
    await expect(page.getByLabel("Visit date")).toHaveAttribute("min", manilaDate());
    await expect(page.getByRole("button", { name: "Join today’s queue" })).toBeVisible();
    await page.getByLabel("Visit date").fill(manilaDate(3));
    await expect(page.getByRole("button", { name: "Book this day" })).toBeVisible();
  });

  test("happy path: Join today’s queue → queue number in the list → still there after reload", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "bk");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    await page.getByRole("button", { name: "Join today’s queue" }).click();
    await expect(page.getByText("You’re in today’s queue. Your number is in the list below.")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: /Q-\d+/ });
    await expect(row).toHaveCount(1);
    const q = (await row.innerText()).match(/Q-\d+/)![0];
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: q })).toHaveCount(1);
    const list = await (await me.api.get("/api/bookings/me")).json();
    const mine = (list.items ?? list)[0];
    cleanup(() => cancelOwnBooking(me.api, mine.booking_id));
    expect(mine).toMatchObject({ queue_number: q, status: "Pending", appointment_date: manilaDate() });
  });

  test("a past date is refused (UI min + API message)", async ({ loginAs, tag, cleanup, guard }) => {
    guard.allow(/400 POST \/api\/bookings\/book/);
    const me = await newPatient({ tag, cleanup }, "bkpast");
    const b = await bookOnline(me.api, manilaDate(-3));
    expect(b.status).toBe(400);
    expect(JSON.stringify(b.body)).toMatch(/past date/i);
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    let posts = 0;
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/bookings/book") && posts++);
    await page.getByLabel("Visit date").fill(manilaDate(-3));
    await page.getByRole("button", { name: /Join today’s queue|Book this day/ }).click();
    await page.waitForTimeout(600);
    const list = await (await me.api.get("/api/bookings/me")).json();
    expect((list.items ?? list).filter((x: any) => x.appointment_date < manilaDate()), "no booking in the past").toHaveLength(0);
  });

  test("a future date books THAT date (not today)", async ({ loginAs, tag, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-07 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const me = await newPatient({ tag, cleanup }, "bkfut");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    await page.getByLabel("Visit date").fill(manilaDate(3));
    await page.getByRole("button", { name: "Book this day" }).click();
    await expect(page.getByText(/You’re booked for/)).toBeVisible();
    const list = await (await me.api.get("/api/bookings/me")).json();
    for (const x of list.items ?? list) cleanup(() => cancelOwnBooking(me.api, x.booking_id));
    expect((list.items ?? list).map((x: any) => x.appointment_date)).toEqual([manilaDate(3)]);
  });

  test("cancel modal: Keep booking changes nothing; Cancel booking cancels it and it moves to the Cancelled tab", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "bkcx");
    const b = await bookOnline(me.api, manilaDate(), tag("cx"));
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    const row = page.getByRole("row").filter({ hasText: b.body.queue_number });
    await row.getByRole("button", { name: "Cancel" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(b.body.queue_number)).toBeVisible();
    await dialog.getByRole("button", { name: "Keep booking" }).click();
    await expect(dialog).toBeHidden();
    await expect(row.getByText("Pending")).toBeVisible();
    expect((await (await me.api.get(`/api/bookings/${b.body.booking_id}`)).json()).status).toBe("Pending");
    await row.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(async () => (await (await me.api.get(`/api/bookings/${b.body.booking_id}`)).json()).status).toBe("Cancelled");
    await page.getByRole("tab", { name: /^Cancelled/ }).click();
    await expect(page.getByRole("row").filter({ hasText: b.body.queue_number })).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: /^Cancelled/ }).click();
    await expect(page.getByRole("row").filter({ hasText: b.body.queue_number })).toBeVisible();
  });

  test("API: a booking already checked in cannot be cancelled by the patient", async ({ tag, cleanup, api, guard }) => {
    guard.off();
    const me = await newPatient({ tag, cleanup }, "bkci");
    const b = await bookOnline(me.api, manilaDate(), tag("ci"));
    const staff = await api("staff");
    expect((await staff.put(`/api/queue/${b.body.booking_id}/check-in`)).ok()).toBeTruthy();
    cleanup(async () => void (await staff.put(`/api/queue/${b.body.booking_id}/cancel`, { data: { reason: "E2E cleanup" } })));
    const r = await me.api.put(`/api/bookings/${b.body.booking_id}/cancel`, { data: { reason: "too late" } });
    expect(r.status()).toBe(400);
    expect(JSON.stringify(await r.json())).toMatch(/hasn't been checked in/);
  });

  test("double submit (click + Enter on the date field) creates exactly one booking", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "bkdbl");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    await page.getByRole("button", { name: "Join today’s queue" }).click();
    await page.getByLabel("Visit date").press("Enter");
    await expect(page.getByText("You’re in today’s queue. Your number is in the list below.")).toBeVisible();
    await page.waitForTimeout(800);
    const list = await (await me.api.get("/api/bookings/me")).json();
    const rows = (list.items ?? list).filter((x: any) => x.status !== "Cancelled");
    for (const x of rows) cleanup(() => cancelOwnBooking(me.api, x.booking_id));
    expect(rows, "one click + one Enter must be one booking").toHaveLength(1);
  });

  test("empty state: a brand-new patient sees no bookings and no errors", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "bkempty");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/bookings");
    await expect(page.getByRole("heading", { name: "Your bookings" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: /Q-\d+/ })).toHaveCount(0);
  });
});

test.describe("/patient/bookings/[id]", () => {
  test("timeline, fee and payment info; cancel from the detail page", async ({ loginAs, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "bkd");
    const b = await bookOnline(me.api, manilaDate(), tag("d"));
    const page = await loginAs(me.email, me.password);
    await page.goto(`/patient/bookings/${b.body.booking_id}`);
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Booking progress" })).toContainText("Pending");
    await expect(page.getByText("₱450")).toBeVisible();
    await expect(page.getByText("Pay at clinic")).toBeVisible();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Keep booking" }).click();
    await expect(page.getByRole("list", { name: "Booking progress" })).toContainText("Pending");
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await page.getByRole("dialog").getByLabel(/Reason/).fill("E2E changed my mind");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
    await expect.poll(async () => (await (await me.api.get(`/api/bookings/${b.body.booking_id}`)).json()).status).toBe("Cancelled");
    expect((await (await me.api.get(`/api/bookings/${b.body.booking_id}`)).json()).cancellation_reason).toBe("E2E changed my mind");
  });

  test("after staff records payment the page shows Paid and a receipt modal", async ({ loginAs, api, tag, cleanup }) => {
    test.fail(true, "BUG-08: patient receipt shows OR-<booking id>, not the OR number the cashier recorded");
    const me = await newPatient({ tag, cleanup }, "bkrec");
    const v = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId);
    const staff = await api("staff");
    const pay = await getPaymentForBooking(staff, v.booking_id);
    const orNo = `OR-${tag("or")}`;
    const r = await staff.post(`/api/payments/${pay.payment_id}/confirm`, { data: { payment_method: "Cash", amount_received: 450, or_number: orNo } });
    expect(r.ok(), await r.text()).toBeTruthy();
    const page = await loginAs(me.email, me.password);
    await page.goto(`/patient/bookings/${v.booking_id}`);
    await expect(page.getByText("Paid").first()).toBeVisible();
    await page.getByRole("button", { name: "View receipt" }).click();
    const dlg = page.getByRole("dialog", { name: "Receipt" });
    await expect(dlg).toContainText("OR ");
    await expect(dlg).toContainText("₱450");
    // BUG-08: the receipt prints OR-<booking id> instead of the OR number the cashier recorded
    expect.soft(await dlg.innerText(), "receipt should show the recorded OR number").toContain(orNo);
    await dlg.getByRole("button", { name: "Close" }).last().click();
    await expect(dlg).toBeHidden();
  });

  test("another patient's booking id is a not-found, never their data", async ({ loginAs, tag, cleanup, guard }) => {
    guard.off();
    const a = await newPatient({ tag, cleanup }, "bkA");
    const b = await newPatient({ tag, cleanup }, "bkB");
    const bk = await bookOnline(a.api, manilaDate(), tag("a"));
    cleanup(() => cancelOwnBooking(a.api, bk.body.booking_id));
    const page = await loginAs(b.email, b.password);
    await page.goto(`/patient/bookings/${bk.body.booking_id}`);
    await expect(page.getByText(bk.body.queue_number)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
  });
});

test.describe("/patient/reviews/[bookingId]", () => {
  test("rating is required; submit once; a second review says already reviewed", async ({ loginAs, api, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "rev");
    const v = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId);
    const page = await loginAs(me.email, me.password);
    await page.goto(`/patient/reviews/${v.booking_id}`);
    const send = page.getByRole("button", { name: "Send review" });
    await expect(send).toBeDisabled();
    await page.getByRole("radio", { name: "4 stars" }).click();
    await expect(page.getByText("Very good")).toBeVisible();
    await expect(send).toBeEnabled();
    await page.getByLabel(/Comment/).fill(tag("review"));
    await send.click();
    await expect(page).toHaveURL(new RegExp(`/patient/bookings/${v.booking_id}`));
    const staff = await api("staff");
    const reviews = await (await staff.get(`/api/reviews?bookingId=${v.booking_id}`)).json();
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ rating: 4 });
    await page.goto(`/patient/reviews/${v.booking_id}`);
    await expect(page.getByText("You've already reviewed this visit. Thank you.")).toBeVisible();
    // API twice → conflict
    const d = (await (await staff.get("/api/doctors")).json())[0];
    const again = await me.api.post("/api/reviews", { data: { booking_id: v.booking_id, doctor_id: d.doctor_id, patient_id: me.patientId, rating: 5 } });
    expect(again.status()).toBe(409);
    expect(JSON.stringify(await again.json())).toMatch(/already been reviewed/);
  });

  test("rating out of range is refused by the API (0, 6, -1)", async ({ api, tag, cleanup, guard }) => {
    guard.off();
    const me = await newPatient({ tag, cleanup }, "revr");
    const v = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId);
    const d = (await (await (await api("staff")).get("/api/doctors")).json())[0];
    for (const rating of [0, 6, -1]) {
      const r = await me.api.post("/api/reviews", { data: { booking_id: v.booking_id, doctor_id: d.doctor_id, patient_id: me.patientId, rating } });
      expect(r.status(), `rating ${rating}`).toBe(400);
    }
  });

  test("double submit (click + Enter) stores one review", async ({ loginAs, api, tag, cleanup, guard }) => {
    guard.allow(/409 POST \/api\/reviews/);
    const me = await newPatient({ tag, cleanup }, "revdbl");
    const v = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId);
    const page = await loginAs(me.email, me.password);
    await page.goto(`/patient/reviews/${v.booking_id}`);
    await page.getByRole("radio", { name: "5 stars" }).click();
    await page.getByRole("button", { name: "Send review" }).click();
    await page.getByLabel(/Comment/).press("Enter").catch(() => undefined);
    await page.waitForURL(/\/patient\/bookings\//);
    const reviews = await (await (await api("staff")).get(`/api/reviews?bookingId=${v.booking_id}`)).json();
    expect(reviews).toHaveLength(1);
  });

  test("a 5,000-char comment is stored or refused cleanly (never a 500)", async ({ loginAs, api, tag, cleanup }) => {
    const me = await newPatient({ tag, cleanup }, "revlong");
    const v = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId);
    const page = await loginAs(me.email, me.password);
    await page.goto(`/patient/reviews/${v.booking_id}`);
    await page.getByRole("radio", { name: "3 stars" }).click();
    await page.getByLabel(/Comment/).fill("y".repeat(5000));
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page).toHaveURL(/\/patient\/bookings\//);
  });

  test("another patient cannot review this visit", async ({ api, tag, cleanup, guard }) => {
    guard.off();
    const a = await newPatient({ tag, cleanup }, "revA");
    const b = await newPatient({ tag, cleanup }, "revB");
    const v = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, a.patientId);
    const d = (await (await (await api("staff")).get("/api/doctors")).json())[0];
    const r = await b.api.post("/api/reviews", { data: { booking_id: v.booking_id, doctor_id: d.doctor_id, patient_id: b.patientId, rating: 1 } });
    expect([403, 404]).toContain(r.status());
  });
});
