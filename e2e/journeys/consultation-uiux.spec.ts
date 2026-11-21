import type { APIRequestContext } from "@playwright/test";
import { test, expect, type Page } from "../support/fixtures";
import { checkInWalkIn, createPatient, type Role } from "../support/api";
import { openSectionByTitle } from "../support/consultation-flow";

//JJQR - AI (Nov 19, 2026) - consultation2 UI/UX: visible Use template bar, empty step circles, More steps, jump to missing, NKDA action
test.describe("Consultation2 UI/UX", () => {
  async function openFreshConsult(as: (role: Role) => Promise<Page>, api: (role: Role) => Promise<APIRequestContext>) {
    const staffApi = await api("staff");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const ticket = await checkInWalkIn(staffApi, patient.patient_id);
    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
    return doctor;
  }

  test("Use template, Manage templates and step bar: visible at the top, all sections including Vaccinations/Fee, no warnings before trying to complete", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await openSectionByTitle(doctor, /1\. Clinical notes/i);
    // 1. visible template picker (no collapsed details to open)
    await expect(doctor.getByLabel("Use SOAP template")).toBeVisible();
    await expect(doctor.getByRole("link", { name: /Manage templates/ })).toHaveCount(1);
    //JJQR - AI (Nov 20, 2026) C6 - Vaccinations + Fee behind More; tab bar wraps with no h-scroll
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await expect(steps.getByRole("button", { name: "More", exact: true })).toBeVisible();
    await expect(steps.getByRole("button", { name: /Vaccinations/ })).toHaveCount(0);
    //JJQR - AI (Nov 21, 2026) - the fee decision is required and always the LAST step: visible without opening More
    await expect(steps.getByRole("button", { name: /Professional Fee/ })).toBeVisible();
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await expect(steps.getByRole("button", { name: /Vaccinations/ })).toBeVisible();
    await expect(steps.getByRole("button", { name: /Professional Fee/ })).toBeVisible();
    expect(await steps.evaluate((nav) => nav.scrollWidth <= nav.clientWidth + 1)).toBe(true);
    //JJQR - END
    //JJQR Nov 20, 2026 - 3. empty required steps show the warning icon on load (no banner click needed)
    await expect(steps.locator('[data-icon="triangle-exclamation"]').first()).toBeVisible();
    //JJQR - END
    //JJQR Nov 20, 2026 - 6. the "required sections left" banner is hidden (SHOW_REQUIRED_LEFT_BANNER = false); gating still applies
    await expect(doctor.getByRole("button", { name: /required sections? left/ })).toHaveCount(0);
    await expect(doctor.getByRole("button", { name: "Complete Consultation" })).toBeDisabled();
    //JJQR - END
  });

  test("allergy badge has a one-tap Record allergies / NKDA action", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    const action = doctor.getByRole("button", { name: "Record allergies / NKDA" });
    await expect(action).toBeVisible();
    await action.click();
    await expect(doctor.locator("#consult-allergy-editor-panel")).toBeVisible();
  });
});
//JJQR - END
