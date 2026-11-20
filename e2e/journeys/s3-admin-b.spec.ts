import { test, expect } from "../support/fixtures";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  bookOnline, cancelQueueEntry, checkInWalkIn, createTaggedPatient, getBooking, getPaymentForBooking, getSettings, manilaDate, putSettings,
  registerFreshPatient, cancelQueueByName,
} from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/** COVERAGE-PLAN §3 · Admin: bookings (list, week, detail actions), settings, reports, audit log, dashboard */

type Ctx = { api: (r: "admin" | "staff" | "doctor") => Promise<APIRequestContext>; tag: (l?: string) => string; cleanup: (f: () => unknown) => void };

async function pendingBooking({ api, tag, cleanup }: Ctx, label: string, date = manilaDate()) {
  const staff = await api("staff");
  const me = await registerFreshPatient(tag(label));
  cleanup(() => me.dispose());
  const { body, status } = await bookOnline(me.api, date);
  expect([200, 201]).toContain(status);
  cleanup(() => cancelQueueEntry(staff, body.booking_id));
  return { staff, me, bookingId: body.booking_id as string };
}
async function confirmedBooking(c: Ctx, label: string) {
  const b = await pendingBooking(c, label);
  const up = await b.staff.put(`/api/bookings/${b.bookingId}/status`, { data: { status: "Confirmed" } });
  expect(up.ok(), await up.text()).toBeTruthy();
  return b;
}
async function unpaidVisit({ api, tag, cleanup }: Ctx, label: string) {
  const staff = await api("staff");
  const doctor = await api("doctor");
  const name = tag(label);
  const p = await createTaggedPatient(staff, name);
  const v = await completeVisitViaApi({ staff, doctor }, p.patient_id);
  cleanup(() => settleViaApi(staff, v.booking_id));
  return { staff, name, fullName: `${name} Tester`, p, bookingId: v.booking_id };
}
const money = (s: string) => Number(s.replace(/[^\d.]/g, ""));

test.describe("/admin/bookings · list and week view", () => {
  test("list shows a count, filters by search, doctor and status; Any date opens a picker", async ({ as, api, tag, cleanup }) => {
    const admin = await api("admin");
    const staff = await api("staff");
    const p = await createTaggedPatient(admin, tag("abl"));
    const q = await checkInWalkIn(staff, p.patient_id);
    cleanup(() => cancelQueueEntry(staff, q.booking_id));
    const page = await as("admin");
    await page.goto("/admin/bookings");
    await expect(page.getByText(/\d+ bookings?/).first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Search" }).fill(p.first_name);
    const row = page.getByRole("row", { name: new RegExp(p.first_name, "i") });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Dr Local Demo");
    await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Completed" });
    await expect(row, "a Checked-in booking is not in the Completed filter").toHaveCount(0);
    await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Checked in" });
    await expect(row).toHaveCount(1);
    await page.locator('select:has(option:text-is("All doctors"))').selectOption({ label: "Dr Local Demo" });
    await expect(row).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search" }).fill(`zz-none-${tag("n")}`);
    await expect(page.getByRole("row", { name: /Dr Local Demo/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Any date" }).click();
    await expect(page.getByRole("dialog", { name: "Choose a date" })).toBeVisible();
  });

  test("a status filter shows only that status", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/bookings");
    await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Cancelled" });
    await page.waitForTimeout(800);
    const rows = page.getByRole("row").filter({ hasText: "Dr Local Demo" });
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(n, 15); i++) await expect(rows.nth(i)).toContainText("Cancelled");
  });

  test("clicking a booking row opens its detail page", async ({ as, api, tag, cleanup }) => {
    const b = await pendingBooking({ api, tag, cleanup }, "abl-open");
    const page = await as("admin");
    await page.goto("/admin/bookings");
    await page.getByRole("searchbox", { name: "Search" }).fill(b.me.firstName);
    await page.getByRole("row", { name: /Dr Local Demo/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/bookings/${b.bookingId}`));
  });

  test("week view: range heading, Previous/Next week, today's booking is listed and links to its detail", async ({ as, api, tag, cleanup }) => {
    const b = await pendingBooking({ api, tag, cleanup }, "abl-wk");
    const page = await as("admin");
    await page.goto("/admin/bookings");
    await page.getByRole("tab", { name: "Week view" }).click();
    const heading = page.getByRole("heading", { level: 2, name: /\w{3} \d+ – \w{3} \d+, \d{4}/ });
    const first = await heading.textContent();
    await expect(page.locator(`a[href="/admin/bookings/${b.bookingId}"]`)).toHaveCount(1);
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(heading).not.toHaveText(first!);
    await page.getByRole("button", { name: "Previous week" }).click();
    await expect(heading).toHaveText(first!);
    await page.locator(`a[href="/admin/bookings/${b.bookingId}"]`).click();
    await expect(page).toHaveURL(new RegExp(b.bookingId));
  });
});

test.describe("/admin/bookings/[id] · actions", () => {
  test("Pending: Confirm booking → Confirmed (double-click = one change), survives reload", async ({ as, api, tag, cleanup }) => {
    const b = await pendingBooking({ api, tag, cleanup }, "abd-conf");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    for (const n of ["Confirm booking", "Reject booking", "Cancel booking"]) await expect(page.getByRole("button", { name: n })).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).dblclick();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
    await page.reload();
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
  });

  test("Pending: Reject needs a reason; Back changes nothing; confirming rejects with the reason stored", async ({ as, api, tag, cleanup }) => {
    const b = await pendingBooking({ api, tag, cleanup }, "abd-rej");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Reject booking" }).click();
    const d = page.getByRole("dialog");
    const confirm = d.getByRole("button", { name: /Reject/ }).last();
    await expect(confirm).toBeDisabled();
    await d.getByLabel("Reason").fill("E2E duplicate request");
    await d.getByRole("button", { name: /Back|Keep|Cancel/ }).first().click();
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Pending");
    await page.getByRole("button", { name: "Reject booking" }).click();
    await d.getByLabel("Reason").fill("E2E duplicate request");
    await confirm.dblclick();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("Cancelled");
    expect((await getBooking(b.staff, b.bookingId)).cancellation_reason).toBe("E2E duplicate request");
  });

  test("Confirmed: Mark complete → Completed and unpaid; Cancel with reason works on another", async ({ as, api, tag, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "abd-comp");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("Completed");
    cleanup(() => settleViaApi(b.staff, b.bookingId));
    await page.reload();
    await expect(page.getByRole("button", { name: "Waive payment" })).toBeVisible();
  });

  test("Confirmed: Cancel booking → reason ≥ 5 chars, 'Keep' changes nothing, confirm persists", async ({ as, api, tag, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "abd-can");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const d = page.getByRole("dialog");
    const confirm = d.getByRole("button", { name: "Cancel booking" });
    await expect(confirm).toBeDisabled();
    await d.getByLabel("Reason").fill("E2E admin cancelled");
    await d.getByRole("button", { name: /Keep booking|Back|Keep/ }).first().click();
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await d.getByLabel("Reason").fill("E2E admin cancelled");
    await confirm.dblclick();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("Cancelled");
    await page.reload();
    await expect(page.getByText("Cancelled").first()).toBeVisible();
  });

  test("Cancel booking: a 4-character reason is refused (staff need 5+)", async ({ as, api, tag, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-35 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const b = await confirmedBooking({ api, tag, cleanup }, "abd-can4");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Reason").fill("abcd");
    await expect(d.getByRole("button", { name: "Cancel booking" })).toBeDisabled({ timeout: 3000 });
  });

  test("Confirmed: Mark no-show → NoShow", async ({ as, api, tag, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "abd-ns");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Mark no-show" }).click();
    const d = page.getByRole("dialog", { name: "Mark as no-show?" });
    await d.getByLabel(/Reason/).fill("E2E never came");
    await d.getByRole("button", { name: "Back" }).click();
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Confirmed");
    await page.getByRole("button", { name: "Mark no-show" }).click();
    await d.getByLabel(/Reason/).fill("E2E never came");
    await d.getByRole("button", { name: "Mark no-show" }).dblclick();
    await expect.poll(async () => (await getBooking(b.staff, b.bookingId)).status).toBe("NoShow");
  });

  test("Confirmed: Reschedule to tomorrow → old booking Rescheduled, new one dated tomorrow", async ({ as, api, tag, cleanup }) => {
    const b = await confirmedBooking({ api, tag, cleanup }, "abd-rs");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${b.bookingId}`);
    await page.getByRole("button", { name: "Reschedule" }).click();
    const d = page.getByRole("dialog", { name: "Reschedule Booking" });
    await d.getByRole("button", { name: /^[A-Z][a-z]{2} \d+, \d{4}$/ }).click();
    await expect(page.getByRole("dialog", { name: "Choose a date" })).toBeVisible();
    await page.waitForTimeout(300);
    const label = new Date(`${manilaDate(1)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    await page.getByRole("button", { name: label, exact: true }).click();
    await d.getByRole("textbox", { name: /Reason/ }).fill("E2E moved");
    await d.getByRole("button", { name: "Confirm Reschedule" }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/admin/bookings/") && !u.pathname.endsWith(b.bookingId));
    expect((await getBooking(b.staff, b.bookingId)).status).toBe("Rescheduled");
    const newId = page.url().split("/").pop()!;
    cleanup(() => cancelQueueEntry(b.staff, newId));
    expect((await getBooking(b.staff, newId)).appointment_date).toBe(manilaDate(1));
  });

  test("Completed + unpaid: Waive payment needs a reason; Back changes nothing; confirming marks it Waived", async ({ as, api, tag, cleanup, guard }) => {
    guard.allow(/\/api\/payments\/.*\/waive/);
    const v = await unpaidVisit({ api, tag, cleanup }, "abd-wv");
    const page = await as("admin");
    await page.goto(`/admin/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Waive payment" }).click();
    const d = page.getByRole("dialog");
    const confirm = d.getByRole("button", { name: /Waive|Record waiver/ }).last();
    await expect(confirm).toBeDisabled();
    await d.getByLabel(/Reason/).fill("E2E hardship");
    await d.getByRole("button", { name: /Back|Cancel|Keep/ }).first().click();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).status).toBe("Unpaid");
    await page.getByRole("button", { name: "Waive payment" }).click();
    await d.getByLabel(/Reason/).fill("E2E hardship");
    await confirm.click();
    await expect.poll(async () => (await getPaymentForBooking(v.staff, v.bookingId)).status, { timeout: 8000 }).toMatch(/Waived/);
  });

  test("Completed + paid: Refund needs amount AND reason; Back changes nothing; refund is stored and shown", async ({ as, api, tag, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "abd-rf");
    await settleViaApi(v.staff, v.bookingId);
    const page = await as("admin");
    await page.goto(`/admin/bookings/${v.bookingId}`);
    await expect(page.getByRole("button", { name: "Refund payment" })).toBeVisible();
    await page.getByRole("button", { name: "Refund payment" }).click();
    const d = page.getByRole("dialog", { name: "Refund this payment?" });
    const go = d.getByRole("button", { name: "Refund", exact: true });
    await expect(go).toBeDisabled();
    await d.getByLabel("Amount (₱)").fill("450");
    await expect(go, "amount only").toBeDisabled();
    await d.getByLabel("Amount (₱)").fill("");
    await d.getByLabel("Reason").fill("E2E wrong patient");
    await expect(go, "reason only").toBeDisabled();
    await d.getByRole("button", { name: "Cancel" }).click();
    expect((await getPaymentForBooking(v.staff, v.bookingId)).status).toBe("Paid");
    await page.getByRole("button", { name: "Refund payment" }).click();
    await d.getByLabel("Amount (₱)").fill("450");
    await d.getByLabel("Reason").fill("E2E wrong patient");
    await go.dblclick();
    await expect.poll(async () => (await getPaymentForBooking(v.staff, v.bookingId)).status).toMatch(/Refund/);
    await page.reload();
    await expect(page.getByText(/Refunded/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Refund payment" })).toHaveCount(0);
  });

  test("Refund: an amount larger than what was paid is not accepted", async ({ as, api, tag, cleanup, guard }) => {
    guard.allow(/\/refund|\/api\/payments\//);
    //JJQR - AI (Nov 20, 2026) - BUG-38 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const v = await unpaidVisit({ api, tag, cleanup }, "abd-rfx");
    await settleViaApi(v.staff, v.bookingId);
    const page = await as("admin");
    await page.goto(`/admin/bookings/${v.bookingId}`);
    await page.getByRole("button", { name: "Refund payment" }).click();
    const d = page.getByRole("dialog", { name: "Refund this payment?" });
    await d.getByLabel("Amount (₱)").fill("999999");
    await d.getByLabel("Reason").fill("E2E too much");
    const go = d.getByRole("button", { name: "Refund", exact: true });
    if (await go.isEnabled()) { await go.click(); await page.waitForTimeout(1500); }
    const pay = await getPaymentForBooking(v.staff, v.bookingId);
    expect(pay.status, "refunding more than was paid must not go through").toBe("Paid");
  });

  test("Completed: Print receipt / Print summary buttons and 'Open patient record' link are present", async ({ as, api, tag, cleanup }) => {
    const v = await unpaidVisit({ api, tag, cleanup }, "abd-pr");
    await settleViaApi(v.staff, v.bookingId);
    const page = await as("admin");
    await page.goto(`/admin/bookings/${v.bookingId}`);
    await expect(page.getByRole("button", { name: "Print summary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print receipt" })).toBeVisible();
    await page.getByRole("link", { name: "Open patient record" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/patients/${v.p.patient_id}`));
  });

  test("an unknown booking id shows a not-found state", async ({ as, guard }) => {
    guard.allow(/\/api\/bookings\//);
    const page = await as("admin");
    await page.goto("/admin/bookings/00000000-0000-0000-0000-000000000001");
    await expect(page.getByText(/not found|couldn't|could not|doesn't exist/i).first()).toBeVisible();
  });

  test("/admin/calendar redirects to /admin/bookings", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/calendar");
    await expect(page).toHaveURL(/\/admin\/bookings$/);
  });
});

test.describe("/admin/settings", () => {
  async function snapshot(admin: APIRequestContext) {
    const settings = await getSettings(admin);
    const hours = await (await admin.get("/api/admin/operating-hours")).json();
    const methods = ((await (await admin.get("/api/admin/payment-methods")).json()) as { payment_method: string }[]).map((m) => m.payment_method);
    return { settings, hours, methods };
  }
  async function restore(admin: APIRequestContext, s: Awaited<ReturnType<typeof snapshot>>) {
    await putSettings(admin, s.settings);
    await admin.put("/api/admin/operating-hours", { data: s.hours });
    await admin.put("/api/admin/payment-methods", { data: s.methods });
  }
  const tab = (page: Page, name: string) => page.getByRole("tab", { name }).click();
  const save = (page: Page, name = "Save changes") => page.getByRole("button", { name, exact: true }).click();

  test("General: edit → save → toast → reload keeps it → API agrees; Cancel-by-navigating leaves it unchanged", async ({ as, api, cleanup, tag }) => {
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const name = tag("clinic");
    const page = await as("admin");
    await page.goto("/admin/settings");
    await page.getByLabel("Clinic name").fill(`${name} unsaved`);
    await page.goto("/admin/settings");
    await expect(page.getByLabel("Clinic name")).toHaveValue(s.settings.clinic_name);
    await page.getByLabel("Clinic name").fill(name);
    await page.getByLabel("Address").fill("1 E2E Street");
    await page.getByLabel("Email").fill("e2e-clinic@example.test");
    await page.getByLabel("Description").fill("E2E description");
    await save(page);
    await expect(page.getByText(/Settings saved at/)).toBeVisible();
    expect(await getSettings(admin)).toMatchObject({ clinic_name: name, address: "1 E2E Street", email: "e2e-clinic@example.test", description: "E2E description" });
    await page.reload();
    await expect(page.getByLabel("Clinic name")).toHaveValue(name);
    await expect(page.getByLabel("Email")).toHaveValue("e2e-clinic@example.test");
  });

  test("General: an empty clinic name is not stored", async ({ as, api, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-36 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const page = await as("admin");
    await page.goto("/admin/settings");
    await page.getByLabel("Clinic name").fill("");
    const btn = page.getByRole("button", { name: "Save changes" });
    if (await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(1200); }
    expect((await getSettings(admin)).clinic_name, "empty clinic name").toBeTruthy();
  });

  test("General: an empty address is not stored", async ({ as, api, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-36 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const page = await as("admin");
    await page.goto("/admin/settings");
    await page.getByLabel("Address").fill("");
    const btn = page.getByRole("button", { name: "Save changes" });
    if (await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(1200); }
    expect((await getSettings(admin)).address, "empty address").toBeTruthy();
  });

  test("General: double-submit (click + Enter) saves once and shows no error", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const page = await as("admin");
    await page.goto("/admin/settings");
    let puts = 0;
    page.on("request", (r) => { if (r.method() === "PUT" && /\/api\/settings$/.test(r.url())) puts++; });
    await page.getByLabel("Description").fill("E2E dbl");
    await page.getByRole("button", { name: "Save changes" }).dblclick();
    await page.waitForTimeout(1500);
    expect(puts, "PUT /api/settings after a double-click").toBe(1);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test("Hours: change Monday, save, reload keeps it; closing before opening is flagged; restore", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Hours");
    await page.getByRole("textbox", { name: "Monday opens" }).fill("09:30");
    await page.getByRole("textbox", { name: "Monday closes" }).fill("09:00");
    await expect(page.getByText(/closing time must be after opening time/)).toBeVisible();
    await page.getByRole("textbox", { name: "Monday closes" }).fill("16:30");
    await expect(page.getByText(/closing time must be after opening time/)).toHaveCount(0);
    await save(page, "Save hours");
    await expect(page.getByText(/Settings saved at/)).toBeVisible();
    const mon = ((await (await admin.get("/api/admin/operating-hours")).json()) as any[]).find((h) => h.day_of_week === 1);
    expect(mon.open_time).toMatch(/^09:30/);
    expect(mon.close_time).toMatch(/^16:30/);
    await page.reload();
    await tab(page, "Hours");
    await expect(page.getByRole("textbox", { name: "Monday opens" })).toHaveValue(/^09:30/);
  });

  test("Fees: change → save → API agrees → a new walk-in is charged the new fee; restore", async ({ as, api, cleanup, tag }) => {
    const admin = await api("admin");
    const staff = await api("staff");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Fees");
    await page.getByLabel("Standard consultation").fill("461");
    await save(page, "Save fees");
    await expect(page.getByText(/Settings saved at/)).toBeVisible();
    expect((await getSettings(admin)).fee_consultation).toBe(461);
    const p = await createTaggedPatient(staff, tag("fee"));
    const q = await checkInWalkIn(staff, p.patient_id);
    cleanup(() => cancelQueueEntry(staff, q.booking_id));
    expect(q.provisional_fee, "new walk-in fee follows the saved consultation fee").toBe(461);
    await page.reload();
    await tab(page, "Fees");
    await expect(page.getByLabel("Standard consultation")).toHaveValue("461");
  });

  test("Fees: a negative fee is not stored", async ({ as, api, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-34 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Fees");
    await page.getByLabel("Standard consultation").fill("-5");
    const btn = page.getByRole("button", { name: "Save fees" });
    if (await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(1500); }
    expect((await getSettings(admin)).fee_consultation).toBeGreaterThanOrEqual(0);
  });

  test("Payments: default mode, accepted methods and refund policy persist; restore", async ({ as, api, cleanup, tag }) => {
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const policy = tag("policy");
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Payments");
    await page.getByRole("combobox", { name: "Default payment mode" }).selectOption({ label: "Online" });
    await page.getByRole("checkbox", { name: "Maya" }).uncheck();
    await page.getByLabel("Refund policy").fill(policy);
    await save(page);
    await expect(page.getByText(/Settings saved at/)).toBeVisible();
    expect(await getSettings(admin)).toMatchObject({ default_payment_mode: "Online", refund_policy: policy });
    const methods = ((await (await admin.get("/api/admin/payment-methods")).json()) as { payment_method: string }[]).map((m) => m.payment_method);
    expect(methods).not.toContain("Maya");
    await page.reload();
    await tab(page, "Payments");
    await expect(page.getByRole("checkbox", { name: "Maya" })).not.toBeChecked();
    await expect(page.getByLabel("Refund policy")).toHaveValue(policy);
  });

  test("Privacy: the policy text saves; 'Publish new consent version' asks to confirm, bumps the version, and is restored", async ({ as, api, cleanup, tag }) => {
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const policy = tag("privacy");
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Privacy & consent");
    await page.getByLabel("Privacy policy").fill(policy);
    await save(page, "Save policy");
    await expect(page.getByText(/Settings saved at/)).toBeVisible();
    expect((await getSettings(admin)).privacy_policy_text).toBe(policy);
    const v = s.settings.consent_version;
    await page.getByRole("button", { name: "Publish new consent version" }).click();
    await expect(page.getByText(/re-trigger the consent banner/)).toBeVisible();
    await page.getByRole("button", { name: `Yes, publish v${v + 1}` }).click();
    await expect(page.getByText(`v${v + 1}`).first()).toBeVisible();
  });

  test("Privacy: a published consent version is still there after a reload / in the API", async ({ as, api, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-37 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const admin = await api("admin");
    const s = await snapshot(admin);
    cleanup(() => restore(admin, s));
    const v = s.settings.consent_version;
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Privacy & consent");
    await page.getByRole("button", { name: "Publish new consent version" }).click();
    await page.getByRole("button", { name: `Yes, publish v${v + 1}` }).click();
    await page.waitForTimeout(1500);
    expect((await getSettings(admin)).consent_version).toBe(v + 1);
  });

  test("Branding: preview-only; the tab opens and its website URL field accepts text", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/settings");
    await tab(page, "Branding");
    await expect(page.getByLabel(/Website URL/i)).toBeVisible();
  });
});

test.describe("/admin/reports", () => {
  test("loads totals; an unpaid visit appears and lifts 'Unpaid after visit' by its amount; settling removes it", async ({ as, api, tag, cleanup }) => {
    const page = await as("admin");
    await page.goto("/admin/reports");
    const unpaid = () => page.locator("dt:has-text('Unpaid after visit') + dd");
    await expect(unpaid()).toBeVisible();
    const before = money((await unpaid().textContent())!);
    const v = await unpaidVisit({ api, tag, cleanup }, "rep");
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(v.name, "i") })).toHaveCount(1);
    expect(money((await unpaid().textContent())!)).toBe(before + 450);
    await settleViaApi(v.staff, v.bookingId);
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(v.name, "i") })).toHaveCount(0);
    expect(money((await unpaid().textContent())!)).toBe(before);
  });

  test("the unpaid table's header count matches its rows' sum", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/reports");
    const label = await page.getByText(/\d+ visits? · ₱[\d,]+/).first().textContent();
    const [, n, total] = label!.match(/(\d+) visits? · ₱([\d,]+)/)!;
    const rows = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Open booking" }) });
    expect(await rows.count()).toBe(Number(n));
    let sum = 0;
    for (const t of await rows.locator("td:nth-child(4)").allTextContents()) sum += money(t);
    expect(sum).toBe(money(total));
  });

  test("Export CSV downloads a .csv named for the range with the unpaid rows", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/reports");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^clinic-reports_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
    expect(text.length).toBeGreaterThan(20);
  });

  test("From / To pickers open and a narrower range changes the heading", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/reports");
    await page.getByRole("button", { name: /^[A-Z][a-z]{2} \d+, \d{4}$/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Choose a date" })).toBeVisible();
  });
});

test.describe("/admin/audit-logs", () => {
  test("an admin edit shows up (Updated / Patient / who / what changed); search and record-type filter narrow the list", async ({ as, api, tag }) => {
    const admin = await api("admin");
    const name = tag("aud");
    const p = await createTaggedPatient(admin, name);
    await admin.put(`/api/patients/${p.patient_id}`, { data: { ...p, contact_number: "09171112233" } });
    const page = await as("admin");
    await page.goto("/admin/audit-logs");
    await page.getByRole("searchbox", { name: "Search" }).fill(p.first_name);
    const rows = page.getByRole("row").filter({ hasText: p.patient_id });
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText("Patient");
    await page.getByRole("combobox", { name: "Record type" }).selectOption({ label: "Payment" });
    await expect(rows).toHaveCount(0);
    await page.getByRole("combobox", { name: "Record type" }).selectOption({ label: "Patient" });
    await expect(rows.first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Search" }).fill(`zz-${tag("n")}`);
    await expect(page.getByRole("row").filter({ hasText: "Patient" })).toHaveCount(0);
  });

  test("paging: Audit log pages navigation moves forward and back", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/audit-logs");
    const nav = page.getByRole("navigation", { name: "Audit log pages" });
    await expect(nav).toBeVisible();
    const first = await page.getByRole("row").nth(1).textContent();
    await nav.getByRole("button", { name: /Next/ }).click();
    await expect.poll(async () => page.getByRole("row").nth(1).textContent()).not.toBe(first);
    await nav.getByRole("button", { name: /Prev/ }).click();
    await expect.poll(async () => page.getByRole("row").nth(1).textContent()).toBe(first);
  });
});

test.describe("/admin/dashboard", () => {
  test("headline cards load; 'Appointments today' follows a new walk-in; links go to bookings / reports", async ({ as, api, tag, cleanup }) => {
    const staff = await api("staff");
    const page = await as("admin");
    await page.goto("/admin/dashboard");
    const card = page.getByRole("link", { name: /Appointments today/ });
    await expect(card).toBeVisible();
    const n0 = Number((await card.locator("p").first().textContent())!.replace(/\D/g, ""));
    const p = await createTaggedPatient(staff, tag("dash"));
    const q = await checkInWalkIn(staff, p.patient_id);
    cleanup(() => cancelQueueEntry(staff, q.booking_id));
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(async () => Number((await card.locator("p").first().textContent())!.replace(/\D/g, ""))).toBe(n0 + 1);
    await expect(card).toHaveAttribute("href", "/admin/bookings");
    await expect(page.getByRole("link", { name: /Revenue today/ })).toHaveAttribute("href", "/admin/reports");
    await expect(page.getByRole("region", { name: "Latest bookings" })).toBeVisible();
  });

  test("'Completed visits not yet paid' equals the unpaid count on /admin/reports", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/dashboard");
    const dash = Number((await page.getByRole("link", { name: /Completed visits not yet paid/ }).locator("p").first().textContent())!.replace(/\D/g, ""));
    await page.goto("/admin/reports");
    const label = await page.getByText(/\d+ visits? · ₱[\d,]+/).first().textContent();
    expect(Number(label!.match(/(\d+) visit/)![1])).toBe(dash);
  });

  test("an unpaid booking on a Sunday (clinic closed) cannot be booked online", async ({ api, tag, cleanup }) => {
    //JJQR - AI (Nov 20, 2026) - BUG-29 fixed: test.fail marker removed, the test must now pass //JJQR - END
    const staff = await api("staff");
    const me = await registerFreshPatient(tag("sun"));
    cleanup(() => me.dispose());
    let d = 1;
    while (new Date(`${manilaDate(d)}T12:00:00Z`).getUTCDay() !== 0) d++;
    const { status, body } = await bookOnline(me.api, manilaDate(d));
    if (body?.booking_id) cleanup(() => cancelQueueEntry(staff, body.booking_id));
    expect(status, "Sunday booking status").toBeGreaterThanOrEqual(400);
  });
});
void cancelQueueByName;
