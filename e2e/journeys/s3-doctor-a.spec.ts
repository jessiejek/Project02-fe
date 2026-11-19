import { test, expect } from "../support/fixtures";
import type { APIRequestContext, Page } from "@playwright/test";
import { DEV_PASSWORD } from "../playwright.config";
import {
  cancelQueueByName, checkInWalkIn, createTaggedPatient, getQueue, manilaDate, restoreDevPassword, getDoctor,
} from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/** COVERAGE-PLAN §3 · Doctor: dashboard, appointments (+[id]), schedule, profile */

const dayLabel = (offset: number) =>
  new Date(`${manilaDate(offset)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

async function restoreStatus(api: (r: "staff") => Promise<APIRequestContext>) {
  const staff = await api("staff");
  const d = await getDoctor(staff);
  await staff.put(`/api/doctors/${d.doctor_id}/day-status`, { data: { doctor_id: d.doctor_id, status_date: manilaDate(), status: "Available", running_late_minutes: null } });
}

test.describe("/doctor/dashboard", () => {
  test("queue counts follow a new walk-in; 'Start consultation' opens that patient's consultation", async ({ as, api, tag, cleanup }) => {
    const staff = await api("staff");
    const page = await as("doctor");
    await page.goto("/doctor/dashboard");
    await expect(page.getByRole("heading", { name: "Your clinic today" })).toBeVisible();
    const waiting = page.getByText(/^\d+ waiting$/).first();
    const w0 = Number((await waiting.textContent())!.match(/\d+/)![0]);
    const name = tag("dr-dash");
    const p = await createTaggedPatient(staff, name);
    cleanup(() => cancelQueueByName(staff, name));
    const t = await checkInWalkIn(staff, p.patient_id);
    await page.reload();
    await expect(page.getByText(`${w0 + 1} waiting`).first()).toBeVisible();
    const { summary } = await getQueue(staff);
    await expect(page.getByText(`${summary.waiting} waiting`).first()).toBeVisible();
    await expect(page.getByText(`${summary.in_progress} in progress`).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Your performance" })).toHaveAttribute("href", "/doctor/performance");
    await expect(page.getByRole("link", { name: "Open appointments" })).toHaveAttribute("href", "/doctor/appointments");
    await expect(page.getByRole("link", { name: "Manage availability" }).first()).toHaveAttribute("href", "/doctor/schedule");
    void t;
  });

  test("Running Late / Unavailable Today / Available save, show on reload, and the staff page agrees", async ({ as, api, cleanup }) => {
    cleanup(() => restoreStatus(api));
    const staff = await api("staff");
    const page = await as("doctor");
    await page.goto("/doctor/dashboard");
    const dayStatus = async () => ((await (await staff.get(`/api/doctors/day-statuses?date=${manilaDate()}`)).json()) as any[])[0]?.status;
    await page.getByRole("button", { name: "Running Late", exact: true }).click();
    await expect.poll(dayStatus).toBe("RunningLate");
    await page.reload();
    await expect(page.getByRole("button", { name: "Running Late", exact: true })).toBeVisible();
    await expect.poll(dayStatus).toBe("RunningLate");
    await page.getByRole("button", { name: "Unavailable Today", exact: true }).click();
    await expect.poll(dayStatus).toBe("UnavailableToday");
    await page.getByRole("button", { name: "Available", exact: true }).click();
    await expect.poll(dayStatus).toBe("Available");
  });

  test("analytics: This Month → This Year → Custom Range switch the heading; Custom shows From and To", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/dashboard");
    await expect(page.getByRole("button", { name: "This Month" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: /Practice Analytics — \w+ \d{4}/ })).toBeVisible();
    await page.getByRole("button", { name: "This Year" }).click();
    await expect(page.getByRole("heading", { name: /Practice Analytics — \d{4}$/ })).toBeVisible();
    await page.getByRole("button", { name: "Custom Range" }).click();
    await expect(page.getByRole("heading", { name: "Practice Analytics — Custom range" })).toBeVisible();
    await expect(page.getByRole("button", { name: "From", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "To", exact: true })).toBeVisible();
  });

  test("'Needs attention' lists a completed visit that is still unpaid", async ({ as, api, tag, cleanup }) => {
    const staff = await api("staff");
    const doctor = await api("doctor");
    const name = tag("dr-attn");
    const p = await createTaggedPatient(staff, name);
    const v = await completeVisitViaApi({ staff, doctor }, p.patient_id);
    cleanup(() => settleViaApi(staff, v.booking_id));
    const page = await as("doctor");
    await page.goto("/doctor/dashboard");
    await expect(page.getByRole("link", { name: new RegExp(`${name} Tester — completed, unpaid ₱450 due`, "i") })).toHaveAttribute("href", `/doctor/appointments/${v.booking_id}`);
  });
});

test.describe("/doctor/appointments", () => {
  async function seed(api: (r: "staff" | "doctor") => Promise<APIRequestContext>, tag: (l?: string) => string, cleanup: (f: () => unknown) => void, label: string, done = false, rx = false) {
    const staff = await api("staff");
    const name = tag(label);
    const p = await createTaggedPatient(staff, name);
    let id: string;
    let q: string;
    if (done) {
      const v = await completeVisitViaApi({ staff, doctor: await api("doctor") }, p.patient_id, { rx });
      cleanup(() => settleViaApi(staff, v.booking_id));
      id = v.booking_id; q = v.queue_number;
    } else {
      const t = await checkInWalkIn(staff, p.patient_id);
      cleanup(() => cancelQueueByName(staff, name));
      id = t.booking_id; q = t.queue_number;
    }
    return { name, fullName: `${name} Tester`, id, queue: q, staff };
  }
  const rowOf = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name, "i") });

  test("search by patient name and by queue number; a nonsense search shows an empty result", async ({ as, api, tag, cleanup }) => {
    const s = await seed(api, tag, cleanup, "dr-ap-s");
    const page = await as("doctor");
    await page.goto("/doctor/appointments");
    const box = page.getByRole("searchbox", { name: /Search patients/ });
    await box.fill(s.name);
    await expect(rowOf(page, s.name)).toHaveCount(1);
    await expect(rowOf(page, s.name).getByRole("link", { name: /Start consultation/ })).toHaveAttribute("href", `/doctor/consultation2/${s.id}`);
    await box.fill(s.queue);
    await expect(rowOf(page, s.name)).toHaveCount(1);
    await box.fill(`zz-nobody-${tag("n")}`);
    await expect(page.getByRole("row", { name: /MF-/ })).toHaveCount(0);
  });

  test("status filters: a waiting patient shows under Waiting and In clinic, not under Completed; a finished one is the reverse", async ({ as, api, tag, cleanup }) => {
    const waiting = await seed(api, tag, cleanup, "dr-ap-w");
    const done = await seed(api, tag, cleanup, "dr-ap-c", true);
    const page = await as("doctor");
    await page.goto("/doctor/appointments");
    await page.getByRole("button", { name: "All statuses" }).click();
    const box = page.getByRole("searchbox", { name: /Search patients/ });
    const filter = async (label: string, term: string) => {
      await page.getByRole("group", { name: "Filter appointment status" }).getByRole("button", { name: label }).click();
      await box.fill(term);
    };
    await filter("Waiting", waiting.name);
    await expect(rowOf(page, waiting.name)).toHaveCount(1);
    await filter("Completed", waiting.name);
    await expect(rowOf(page, waiting.name)).toHaveCount(0);
    await filter("Completed", done.name);
    await expect(rowOf(page, done.name)).toHaveCount(1);
    await filter("Waiting", done.name);
    await expect(rowOf(page, done.name)).toHaveCount(0);
    await filter("In clinic", waiting.name);
    await expect(rowOf(page, waiting.name)).toHaveCount(1);
  });

  test("Today ↔ History switches the page and History lists past/finished visits with a View link", async ({ as, api, tag, cleanup }) => {
    const done = await seed(api, tag, cleanup, "dr-ap-h", true);
    const page = await as("doctor");
    await page.goto("/doctor/appointments");
    await expect(page.getByRole("heading", { name: "Today's appointments" })).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("heading", { name: "Appointment history" })).toBeVisible();
    await page.getByRole("searchbox", { name: /Search patients/ }).fill(done.name);
    await expect(rowOf(page, done.name).getByRole("link", { name: "View" })).toHaveAttribute("href", `/doctor/appointments/${done.id}`);
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "Today's appointments" })).toBeVisible();
  });

  test("appointment detail: payment, fee, consultation links and the summary of a completed visit", async ({ as, api, tag, cleanup }) => {
    const done = await seed(api, tag, cleanup, "dr-ap-d", true, true);
    const page = await as("doctor");
    await page.goto(`/doctor/appointments/${done.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(done.name, "i"));
    await expect(page.getByText("Payment: Unpaid")).toBeVisible();
    await expect(page.getByText(/₱450 total · ₱450 due/)).toBeVisible();
    await expect(page.getByRole("link", { name: "View Consultation" })).toHaveAttribute("href", `/doctor/consultation2/${done.id}?mode=view`);
    await expect(page.getByRole("link", { name: "Edit / Amend" })).toHaveAttribute("href", `/doctor/consultation2/${done.id}?mode=amend`);
    await expect(page.getByRole("button", { name: "Print Prescription" })).toBeVisible();
    await expect(page.getByText("E2E seeded complaint").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to appointments" })).toHaveAttribute("href", "/doctor/appointments");
  });
});

test.describe("/doctor/schedule", () => {
  async function snapshot(doc: APIRequestContext) {
    const d = await getDoctor(doc);
    const rows: any[] = await (await doc.get(`/api/doctors/${d.doctor_id}/schedules`)).json();
    return { d, rows };
  }
  /** Put the schedule/limit/blocked dates back the way they were (no rows → all days inactive). */
  async function restore(doc: APIRequestContext, snap: Awaited<ReturnType<typeof snapshot>>, admin: APIRequestContext) {
    const { d, rows } = snap;
    for (let day = 0; day < 7; day++) {
      const orig = rows.find((r) => r.day_of_week === day);
      await doc.put(`/api/doctors/${d.doctor_id}/schedules`, { data: orig ?? { doctor_id: d.doctor_id, day_of_week: day, is_active: false, start_time: "09:00:00", end_time: "17:00:00" } });
    }
    const cur = await getDoctor(admin);
    await admin.put(`/api/doctors/${d.doctor_id}`, { data: { ...cur, daily_patient_limit: d.daily_patient_limit ?? null } });
    const blocked: any[] = await (await doc.get(`/api/doctors/${d.doctor_id}/blocked-dates`)).json();
    for (const b of blocked) if ((b.reason ?? "").startsWith("E2E-")) await doc.delete(`/api/doctors/blocked-dates/${b.id}`);
  }
  const monTimes = (page: Page) => ({
    box: page.getByRole("checkbox", { name: "Mon" }),
    open: page.getByRole("textbox", { name: "Mon opening time" }),
    close: page.getByRole("textbox", { name: "Mon closing time" }),
  });
  const save = (page: Page) => page.getByRole("button", { name: "Save availability" });

  test("tick Monday, set hours, save → reload keeps them; untick closes the day", async ({ as, api, cleanup }) => {
    test.fail(true, "BUG-27: 'Save availability' always fails for a doctor — the page first calls PUT /api/doctors/{id}, which is Admin-only (403)");
    const doc = await api("doctor");
    const snap = await snapshot(doc);
    cleanup(async () => restore(doc, snap, await api("admin")));
    const page = await as("doctor");
    await page.goto("/doctor/schedule");
    const m = monTimes(page);
    if (await m.box.isChecked()) await m.box.uncheck();
    await expect(m.open).toBeDisabled();
    await m.box.check();
    await expect(m.open).toBeEnabled();
    await m.open.fill("08:30");
    await m.close.fill("16:45");
    await save(page).dblclick();
    await expect(page.getByText(/saved at/i).first()).toBeVisible();
    await page.reload();
    await expect(monTimes(page).box).toBeChecked();
    await expect(monTimes(page).open).toHaveValue("08:30");
    await expect(monTimes(page).close).toHaveValue("16:45");
    await monTimes(page).box.uncheck();
    await save(page).click();
    await expect(page.getByText(/saved at/i).first()).toBeVisible();
    await page.reload();
    await expect(monTimes(page).box).not.toBeChecked();
  });

  test("closing time not after opening time is refused with a message and nothing is saved", async ({ as, api, cleanup }) => {
    const doc = await api("doctor");
    const snap = await snapshot(doc);
    cleanup(async () => restore(doc, snap, await api("admin")));
    const page = await as("doctor");
    await page.goto("/doctor/schedule");
    const m = monTimes(page);
    if (!(await m.box.isChecked())) await m.box.check();
    await m.open.fill("17:00");
    await m.close.fill("09:00");
    await save(page).click();
    await expect(page.getByText("Mon: end time must be after start time.")).toBeVisible();
    await m.close.fill("17:00"); // equal is also not "after"
    await save(page).click();
    await expect(page.getByText("Mon: end time must be after start time.")).toBeVisible();
    const after = await snapshot(doc);
    expect(after.rows.find((r) => r.day_of_week === 1 && r.is_active && r.start_time.startsWith("17:00"))).toBeUndefined();
  });

  test("daily patient limit: negative and fractional numbers are refused; blank = no limit; 5 persists", async ({ as, api, cleanup }) => {
    test.fail(true, "BUG-27: saving a valid daily limit fails for a doctor (PUT /api/doctors/{id} is Admin-only → 403); the refusals themselves work");
    const doc = await api("doctor");
    const snap = await snapshot(doc);
    cleanup(async () => restore(doc, snap, await api("admin")));
    const page = await as("doctor");
    await page.goto("/doctor/schedule");
    const limit = page.getByRole("spinbutton", { name: "Daily patient limit" });
    for (const bad of ["-1", "2.5"]) {
      await limit.fill(bad);
      await save(page).click();
      await expect(page.getByText(/Daily patient limit must be a non-negative whole number/), `limit ${bad}`).toBeVisible();
    }
    await limit.fill("5");
    await save(page).click();
    await expect(page.getByText(/saved at/i).first()).toBeVisible();
    await page.reload();
    await expect(limit).toHaveValue("5");
    expect((await getDoctor(doc)).daily_patient_limit).toBe(5);
    await limit.fill("");
    await save(page).click();
    await expect(page.getByText(/saved at/i).first()).toBeVisible();
    expect((await getDoctor(doc)).daily_patient_limit).toBeNull();
  });

  test("block a date: Cancel changes nothing; blocking lists it with the reason, survives reload; Remove deletes it", async ({ as, api, tag, cleanup }) => {
    const doc = await api("doctor");
    const snap = await snapshot(doc);
    cleanup(async () => restore(doc, snap, await api("admin")));
    const reason = tag("blk");
    const target = 40;
    const page = await as("doctor");
    await page.goto("/doctor/schedule");
    const open = async () => {
      await page.getByRole("button", { name: "Block a date" }).click();
      const d = page.getByRole("dialog", { name: "Add Blocked Date" });
      await d.getByRole("button", { name: "Select date" }).click();
      await expect(page.getByRole("dialog", { name: "Choose a date" })).toBeVisible();
      await page.waitForTimeout(300);
      for (let i = 0; i < 3 && !(await page.getByRole("button", { name: dayLabel(target), exact: true }).isVisible()); i++) {
        await page.getByRole("button", { name: "Next month" }).click();
      }
      await page.getByRole("button", { name: dayLabel(target), exact: true }).click();
      return d;
    };
    // cancel
    let d = await open();
    await d.getByRole("textbox", { name: "Reason" }).fill(reason);
    await d.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(reason)).toHaveCount(0);
    // block
    d = await open();
    await d.getByRole("textbox", { name: "Reason" }).fill(reason);
    await d.getByRole("button", { name: "Block this date" }).click();
    await expect(page.getByText(reason)).toBeVisible();
    await page.reload();
    await expect(page.getByText(reason)).toBeVisible();
    const blocked: any[] = await (await doc.get(`/api/doctors/${snap.d.doctor_id}/blocked-dates`)).json();
    expect(blocked.filter((b) => b.reason === reason && b.blocked_date === manilaDate(target))).toHaveLength(1);
    // remove
    await page.getByRole("button", { name: /Remove|Unblock|Delete/ }).first().click();
    await expect(page.getByText(reason)).toHaveCount(0);
    const after: any[] = await (await doc.get(`/api/doctors/${snap.d.doctor_id}/blocked-dates`)).json();
    expect(after.filter((b) => b.reason === reason)).toHaveLength(0);
  });

  test("a doctor can store weekly hours through the API and the page shows them", async ({ as, api, cleanup }) => {
    const doc = await api("doctor");
    const snap = await snapshot(doc);
    cleanup(async () => restore(doc, snap, await api("admin")));
    const put = await doc.put(`/api/doctors/${snap.d.doctor_id}/schedules`, { data: { doctor_id: snap.d.doctor_id, day_of_week: 1, is_active: true, start_time: "08:15:00", end_time: "15:45:00" } });
    expect(put.ok()).toBeTruthy();
    const page = await as("doctor");
    await page.goto("/doctor/schedule");
    await expect(monTimes(page).box).toBeChecked();
    await expect(monTimes(page).open).toHaveValue("08:15");
    await expect(monTimes(page).close).toHaveValue("15:45");
  });

  test("the calendar in 'Add Blocked Date' does not offer past days", async ({ as }) => {
    test.fail(true, "BUG-26: the Add Blocked Date calendar lets the doctor pick a past day (same date-picker issue as BUG-23)");
    const page = await as("doctor");
    await page.goto("/doctor/schedule");
    await page.getByRole("button", { name: "Block a date" }).click();
    await page.getByRole("dialog", { name: "Add Blocked Date" }).getByRole("button", { name: "Select date" }).click();
    await expect(page.getByRole("button", { name: dayLabel(-1), exact: true })).toBeDisabled();
  });
});

test.describe("/doctor/profile", () => {
  async function snap(doc: APIRequestContext) {
    const d = await getDoctor(doc);
    const acct = d.staff_accounts;
    return { d, acct };
  }
  async function restore(admin: APIRequestContext, s: Awaited<ReturnType<typeof snap>>) {
    await admin.put(`/api/doctors/${s.d.doctor_id}`, { data: s.d });
    await admin.put(`/api/staff-accounts/${s.d.doctor_id}`, { data: s.acct });
  }

  test("edit every field → 'Profile saved' → reload keeps them → API agrees", async ({ as, api, cleanup }) => {
    test.fail(true, "BUG-27: 'Save profile' always fails for a doctor — it calls PUT /api/doctors/{id}, which is Admin-only (403)");
    const doc = await api("doctor");
    const s = await snap(doc);
    cleanup(async () => restore(await api("admin"), s));
    const page = await as("doctor");
    await page.goto("/doctor/profile");
    await page.getByLabel("Full Name").fill("Dr E2E Renamed");
    await page.getByLabel("Specialization").fill("Pediatrics");
    await page.getByLabel("Bio").fill("E2E bio");
    await page.getByLabel("Consultation Fee").fill("475");
    await page.getByLabel("License #").fill("LIC-E2E-1");
    await page.getByLabel("PTR #").fill("PTR-E2E-2");
    await page.getByLabel("S2 #").fill("S2-E2E-2");
    await page.getByRole("button", { name: "Save profile" }).dblclick();
    await expect(page.getByText(/Profile saved at/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Full Name")).toHaveValue("Dr E2E Renamed");
    await expect(page.getByLabel("Specialization")).toHaveValue("Pediatrics");
    await expect(page.getByLabel("Bio")).toHaveValue("E2E bio");
    await expect(page.getByLabel("Consultation Fee")).toHaveValue("475");
    await expect(page.getByLabel("License #")).toHaveValue("LIC-E2E-1");
    await expect(page.getByLabel("PTR #")).toHaveValue("PTR-E2E-2");
    await expect(page.getByLabel("S2 #")).toHaveValue("S2-E2E-2");
    const now = await getDoctor(doc);
    expect(now).toMatchObject({ specialization: "Pediatrics", license_number: "LIC-E2E-1", ptr_number: "PTR-E2E-2", s2_number: "S2-E2E-2" });
    expect(Number(now.consultation_fee)).toBe(475);
  });

  test("empty name, negative fee and a non-numeric fee are refused", async ({ as, api, cleanup }) => {
    const doc = await api("doctor");
    const s = await snap(doc);
    cleanup(async () => restore(await api("admin"), s));
    const page = await as("doctor");
    await page.goto("/doctor/profile");
    const bad = page.getByText(/Enter your full name and a valid non-negative c/);
    await page.getByLabel("Full Name").fill("");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(bad).toBeVisible();
    await page.getByLabel("Full Name").fill("Dr Local Demo");
    for (const fee of ["-5", "abc"]) {
      await page.getByLabel("Consultation Fee").fill(fee);
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(bad, `fee "${fee}"`).toBeVisible();
    }
    expect(Number((await getDoctor(doc)).consultation_fee)).toBe(Number(s.d.consultation_fee));
  });

  test("password: mismatch / too short block the button; wrong current password refused; a correct change lets the new password log in", async ({ as, cleanup, guard }) => {
    guard.allow(/\/api\/auth\/change-password/);
    const NEW = "E2e-Temp-Pass-2!";
    cleanup(() => restoreDevPassword("doctor@clinic.test", [NEW]));
    const page = await as("doctor");
    await page.goto("/doctor/profile");
    const update = page.getByRole("button", { name: "Update Password" });
    await expect(update).toBeDisabled();
    await page.getByLabel("Current Password").fill(DEV_PASSWORD);
    await page.getByLabel("New Password", { exact: true }).fill("12345");
    await page.getByLabel("Confirm Password").fill("12345");
    await expect(update, "5 characters").toBeDisabled();
    await page.getByLabel("New Password", { exact: true }).fill(NEW);
    await page.getByLabel("Confirm Password").fill("nope");
    await expect(update, "mismatch").toBeDisabled();
    await page.getByLabel("Confirm Password").fill(NEW);
    await page.getByLabel("Current Password").fill("Wrong-Current-1!");
    await update.click();
    await expect(page.getByText(/incorrect|invalid|wrong|not match|could not/i).first()).toBeVisible();
    await page.getByLabel("Current Password").fill(DEV_PASSWORD);
    await update.click();
    await expect(page.getByText(/password (updated|changed)|updated/i).first()).toBeVisible();
    const { request } = await import("@playwright/test");
    const { BE_URL } = await import("../playwright.config");
    const ctx = await request.newContext({ baseURL: BE_URL });
    expect((await ctx.post("/api/auth/login", { data: { email: "doctor@clinic.test", password: NEW } })).ok()).toBeTruthy();
    await ctx.dispose();
  });

  test("/doctor/settings redirects to the profile page", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/settings");
    await expect(page).toHaveURL(/\/doctor\/profile/);
  });
});
