//JJQR Nov 20, 2026 - Charge PF default, No follow-up satisfies section 6, no allergy Acknowledge gate, one-click logout
import type { APIRequestContext } from "@playwright/test";
import { test, expect, type Page } from "../support/fixtures";
import { checkInWalkIn, createPatient, type Role } from "../support/api";
import { openSectionByTitle } from "../support/consultation-flow";

const SHOTS = process.env.E2E_SHOT_DIR ?? "e2e/test-results";

async function openFreshConsult(as: (role: Role) => Promise<Page>, api: (role: Role) => Promise<APIRequestContext>) {
  const staffApi = await api("staff");
  const patient = await createPatient(staffApi, Date.now().toString(36));
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await expect(doctor.getByRole("navigation", { name: "Consultation sections" })).toBeVisible({ timeout: 30_000 });
  return doctor;
}

test("Professional fee defaults to Charge with the computed clinic fee", async ({ as, api }) => {
  const doctor = await openFreshConsult(as, api);
  await openSectionByTitle(doctor, /Professional Fee/i);
  const main = doctor.getByRole("main");
  const charge = main.getByRole("button", { name: "Charge", exact: true });
  await expect(charge).toHaveClass(/border-primary/);
  await expect(main.getByRole("button", { name: "Decide at desk" })).not.toHaveClass(/border-primary/);
  const computed = await main.getByText(/Computed clinic fee:/).locator("strong").innerText();
  const amount = main.getByPlaceholder("Amount*");
  await expect(amount).toHaveValue(computed.replace(/[^\d.]/g, ""));
  await doctor.screenshot({ path: `${SHOTS}/pf-charge-default.png`, fullPage: false });
  // Decide at desk still selectable
  await main.getByRole("button", { name: "Decide at desk" }).click();
  await expect(main.getByRole("button", { name: "Decide at desk" })).toHaveClass(/border-primary/);
});

test("No follow-up radio alone satisfies Follow-up (no extra checkbox)", async ({ as, api }) => {
  const doctor = await openFreshConsult(as, api);
  await openSectionByTitle(doctor, /Follow-up/i);
  await doctor.getByRole("radio", { name: "No follow-up" }).check();
  await expect(doctor.getByText("Required for Complete when you are not scheduling follow-up.")).toHaveCount(0);
  await expect(doctor.getByRole("checkbox", { name: /No follow-up for this visit/ })).toHaveCount(0);
  const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
  await expect(steps.getByRole("button", { name: /Follow-up/ }).locator('[data-icon="triangle-exclamation"]')).toHaveCount(0);
  await doctor.screenshot({ path: `${SHOTS}/followup-none.png` });
});

test("Prescription has no allergy Acknowledge gate", async ({ as, api }) => {
  const doctor = await openFreshConsult(as, api);
  await openSectionByTitle(doctor, /Prescription/i);
  await expect(doctor.locator("#rx-allergy-review-banner")).toHaveCount(0);
  await expect(doctor.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
  await doctor.screenshot({ path: `${SHOTS}/rx-no-ack.png` });
});

test("Logout works with ONE click and / then shows the public page, dashboard redirects to /login", async ({ as }) => {
  const doctor = await as("doctor");
  await doctor.goto("/doctor/dashboard");
  await expect(doctor.getByRole("link", { name: /logout/i }).first()).toBeVisible({ timeout: 30_000 });
  await doctor.getByRole("link", { name: /logout/i }).first().click();
  await doctor.waitForURL(/\/login$/, { timeout: 15_000 });
  const cookies = (await doctor.context().cookies()).filter((c) => c.name.startsWith("clinic_"));
  expect(cookies).toHaveLength(0);
  await doctor.goto("/doctor/dashboard");
  await expect(doctor).toHaveURL(/\/login/);
  await doctor.screenshot({ path: `${SHOTS}/logout-one-click.png` });
});
test("Diagnosis step is hidden and steps are numbered without gaps", async ({ as, api }) => {
  const doctor = await openFreshConsult(as, api);
  const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
  await expect(steps.getByRole("button", { name: /Diagnosis/ })).toHaveCount(0);
  const labels = (await steps.getByRole("button").allInnerTexts()).map((t) => t.match(/^\s*(\d+)\./)?.[1]).filter(Boolean).map(Number);
  expect(labels.length).toBeGreaterThan(3);
  expect(labels).toEqual(labels.map((_, i) => i + 1));
  await expect(doctor.getByText(/required sections? left.*Diagnosis/)).toHaveCount(0);
  await doctor.screenshot({ path: `${SHOTS}/diagnosis-hidden.png` });
});

test("Logout still completes with ONE click when a dev reload cancels the /logout navigation", async ({ as }) => {
  const doctor = await as("doctor");
  await doctor.goto("/doctor/dashboard");
  await expect(doctor.getByRole("link", { name: /logout/i }).first()).toBeVisible({ timeout: 30_000 });
  // Simulate what Jessie's Safari log shows: the first /logout navigation gets cancelled and the page reloads
  // (next dev compiles /logout -> Fast Refresh full reload). No second click is made.
  let cancelled = false;
  await doctor.route("**/logout", async (route) => {
    if (!cancelled) { cancelled = true; await route.abort("aborted"); return; }
    await route.continue();
  });
  await doctor.getByRole("link", { name: /logout/i }).first().click();
  await expect.poll(() => cancelled).toBe(true);
  await doctor.reload().catch(() => {});
  await doctor.waitForURL(/\/login$/, { timeout: 20_000 });
  expect((await doctor.context().cookies()).filter((c) => c.name.startsWith("clinic_"))).toHaveLength(0);
  await doctor.goto("/doctor/dashboard");
  await expect(doctor).toHaveURL(/\/login/);
});
//JJQR - END
