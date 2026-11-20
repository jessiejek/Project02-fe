import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";
import { createTaggedPatient } from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";
import { journeyOne } from "../support/journey";

/** COVERAGE-PLAN §6 · iPad portrait (768×1024): journey 1 + consultation + patient portal · phone (375×812): patient portal */

const PATIENT_PAGES: [string, RegExp][] = [
  ["/patient/dashboard", /dashboard|welcome|hello|book/i],
  ["/patient/bookings", /bookings|appointments/i],
  ["/patient/doctors", /doctors|Dr /i],
  ["/patient/medical-records", /medical records/i],
  ["/patient/prescriptions", /prescriptions/i],
  ["/patient/vaccinations", /vaccinations/i],
  ["/patient/documents", /documents/i],
  ["/patient/lab-results", /lab results/i],
  ["/patient/profile", /profile/i],
  ["/patient/privacy-consent", /privacy|consent|information/i],
];

async function noSideScroll(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `${label}: page is wider (${m.sw}px) than the screen (${m.cw}px) — sideways scrolling`).toBeLessThanOrEqual(m.cw + 1);
}

for (const [name, viewport] of [["iPad portrait 768×1024", { width: 768, height: 1024 }], ["phone 375×812", { width: 375, height: 812 }]] as const) {
  test.describe(`§6 patient portal · ${name}`, () => {
    test.use({ viewport });
    for (const [path, heading] of PATIENT_PAGES) {
      test(`${path} fits the screen and shows its heading`, async ({ as }) => {
        //JJQR - AI (Nov 20, 2026) - B-39 fixed: test.fail marker removed, /patient/doctors must now fit the screen //JJQR - END
        const page = await as("patient");
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(heading);
        await noSideScroll(page, path);
      });
    }

    test("navigation is reachable (menu button or sidebar) and opens another page", async ({ as }) => {
      const page = await as("patient");
      await page.goto("/patient/dashboard");
      const menu = page.getByRole("button", { name: /menu|navigation|open/i }).first();
      if (await menu.isVisible().catch(() => false)) await menu.click();
      const link = page.getByRole("link", { name: /Bookings|Appointments/i }).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/patient\/bookings/);
    });

    test("the Book a visit page is usable (date picker opens, nothing overflows)", async ({ as }) => {
      const page = await as("patient");
      await page.goto("/patient/bookings");
      const book = page.getByRole("link", { name: /Book/i }).first();
      if (await book.isVisible().catch(() => false)) await book.click();
      await noSideScroll(page, "booking");
    });
  });
}

test.describe("§6 iPad portrait · staff, doctor and journey 1", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("journey 1 end to end on an iPad", async ({ as, loginAs, api, tag, cleanup }) => {
    await journeyOne({ as, loginAs, api, tag, cleanup } as any, { label: "j1pad" });
  });

  test("staff queue, walk-in and payments fit the screen", async ({ as }) => {
    const page = await as("staff");
    for (const path of ["/staff/dashboard", "/staff/queue", "/staff/walk-in", "/staff/payments", "/staff/patients", "/staff/bookings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await noSideScroll(page, path);
    }
  });

  test("the consultation screen fits and every main section is reachable", async ({ as, api, tag, cleanup }) => {
    const staff = await api("staff");
    const doctor = await api("doctor");
    const p = await createTaggedPatient(staff, tag("pad"));
    const v = await completeVisitViaApi({ staff, doctor }, p.patient_id, { leaveOpen: true });
    cleanup(async () => {
      await staff.put(`/api/queue/${v.booking_id}/complete`).catch(() => undefined);
      await settleViaApi(staff, v.booking_id);
    });
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await noSideScroll(page, "consultation");
    for (const name of [/Vital/i, /Diagnos/i, /Prescri/i]) await expect(page.getByText(name).first()).toBeVisible();
  });

  test("doctor and admin main pages fit the screen", async ({ as }) => {
    const d = await as("doctor");
    for (const path of ["/doctor/dashboard", "/doctor/appointments", "/doctor/patients", "/doctor/schedule", "/doctor/templates"]) {
      await d.goto(path);
      await noSideScroll(d, path);
    }
    const a = await as("admin");
    for (const path of ["/admin/dashboard", "/admin/bookings", "/admin/patients", "/admin/settings", "/admin/reports"]) {
      await a.goto(path);
      await noSideScroll(a, path);
    }
  });
});
