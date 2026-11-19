import type { APIRequestContext } from "@playwright/test";
import { test, expect, type Page } from "../support/fixtures";
import { checkInWalkIn, createPatient, type Role } from "../support/api";
import { openSectionByTitle } from "../support/consultation-flow";

//JJQR - AI (Nov 19, 2026) - Rx templates in consultation2: tapping a template adds its medicines (or says why not); every row editable; wide modal
test.describe("Consultation2 Rx templates", () => {
  async function openRxTemplates(as: (role: Role) => Promise<Page>, api: (role: Role) => Promise<APIRequestContext>) {
    const staffApi = await api("staff");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const ticket = await checkInWalkIn(staffApi, patient.patient_id);
    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
    await openSectionByTitle(doctor, /4\. Prescription/);
    await doctor.getByRole("tab", { name: "Templates" }).or(doctor.getByRole("button", { name: "Templates", exact: true })).first().click();
    return doctor;
  }

  test("tapping a template adds all its medicines; before allergies are reviewed it says why instead of doing nothing", async ({ as, api }) => {
    const doctor = await openRxTemplates(as, api);
    await expect(doctor.getByText(/Prescription items \(0\)/)).toBeVisible();

    // allergy gate: no silent no-op
    await doctor.getByRole("button", { name: "Acute gastroenteritis" }).first().click();
    await expect(doctor.getByTestId("rx-template-notice")).toContainText("Review the patient's allergies first");
    await expect(doctor.getByText(/Prescription items \(0\)/)).toBeVisible();

    // acknowledge, then the template adds every medicine and reports it
    await doctor.getByRole("button", { name: "Acknowledge" }).click();
    await doctor.getByRole("button", { name: "Acute gastroenteritis" }).first().click();
    await expect(doctor.getByTestId("rx-template-notice")).toContainText(/Added 2 medicines from Acute gastroenteritis/);
    await expect(doctor.getByText(/Prescription items \(2\)/)).toBeVisible();

    // tapping again adds nothing new, and says so
    await doctor.getByRole("button", { name: "Acute gastroenteritis" }).first().click();
    await expect(doctor.getByTestId("rx-template-notice")).toContainText(/Nothing added: all 2 medicines/);
    await expect(doctor.getByText(/Prescription items \(2\)/)).toBeVisible();
  });
});
//JJQR - END
