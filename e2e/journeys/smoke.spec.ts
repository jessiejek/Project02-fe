import { test, expect } from "../support/fixtures";
import type { Role } from "../support/api";

/**
 * Automated version of a manual click-through: every nav route per role must
 * load without an SSR error page and without an uncaught console error.
 * This is the net that would have caught the patient-portal doctor-ratings 403.
 */
const ROUTES: Record<Role, string[]> = {
  admin: [
    "/admin/dashboard", "/admin/bookings", "/admin/walk-in", "/admin/calendar",
    "/admin/doctors", "/admin/patients", "/admin/staff", "/admin/announcements",
    "/admin/settings", "/admin/audit-logs", "/admin/reports",
  ],
  doctor: [
    "/doctor/dashboard", "/doctor/appointments", "/doctor/patients",
    "/doctor/schedule", "/doctor/settings", "/doctor/profile",
  ],
  staff: [
    "/staff/dashboard", "/staff/bookings", "/staff/payments", "/staff/walk-in",
    "/staff/queue", "/staff/patients", "/staff/doctor-status",
    "/staff/announcements", "/staff/profile",
  ],
  patient: [
    "/patient/dashboard", "/patient/doctors", "/patient/bookings",
    "/patient/medical-records", "/patient/prescriptions", "/patient/vaccinations",
    "/patient/documents", "/patient/lab-results", "/patient/privacy-consent",
    "/patient/profile",
  ],
};

for (const [role, routes] of Object.entries(ROUTES) as [Role, string[]][]) {
  test.describe(`smoke · ${role}`, () => {
    for (const route of routes) {
      test(route, async ({ as }) => {
        const page = await as(role);
        const consoleErrors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(m.text());
        });
        page.on("pageerror", (e) => consoleErrors.push(String(e)));

        // Next's dev server occasionally 500s on a cold route ("Manifest file is
        // empty") while it compiles under load — a reload fixes it, same as a real
        // user would. Only retry that transient; a persistent 5xx still fails.
        let resp = await page.goto(route, { waitUntil: "domcontentloaded" });
        for (let i = 0; i < 3 && (resp?.status() ?? 500) >= 500; i++) {
          await page.waitForTimeout(800);
          resp = await page.reload({ waitUntil: "domcontentloaded" });
        }
        expect(resp?.status(), `${route} HTTP status`).toBeLessThan(400);

        // Next.js error boundary / SSR failure page
        await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
        await expect(page.getByText("Application error")).toHaveCount(0);

        // page rendered *something* — a heading, not a blank/stuck shell
        await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });

        // give async client fetches a beat to reject
        await page.waitForTimeout(1500);
        const real = consoleErrors.filter(
          (t) => !/favicon|Download the React DevTools|hydrat/i.test(t),
        );
        expect(real, `${route} console errors:\n${real.join("\n")}`).toEqual([]);
      });
    }
  });
}
