import type { APIRequestContext } from "@playwright/test";
import { test, expect, type Page } from "../support/fixtures";
import { checkInWalkIn, createPatient, type Role } from "../support/api";
import { completeConsultFromUi, fillRequiredConsultFields, openSectionByTitle } from "../support/consultation-flow";

//JJQR - AI (Nov 20, 2026) C1–C6
test.describe("Consultation2 simplify C1–C6", () => {
  async function openFreshConsult(as: (role: Role) => Promise<Page>, api: (role: Role) => Promise<APIRequestContext>) {
    const staffApi = await api("staff");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const ticket = await checkInWalkIn(staffApi, patient.patient_id);
    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
    return doctor;
  }

  test("C1 type asthma shows ICD-10 J45.9 and Enter adds it", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await openSectionByTitle(doctor, /3\. Diagnosis/i);
    const box = doctor.getByRole("combobox", { name: /Diagnosis \(search ICD-10/ });
    await box.fill("asthma");
    const option = doctor.getByRole("option", { name: /J45\.9 Asthma, unspecified/i });
    await expect(option).toBeVisible({ timeout: 15_000 });
    await expect(doctor.getByText("ICD-10", { exact: true }).first()).toBeVisible();
    await box.press("Enter");
    await expect(doctor.getByText(/Asthma, unspecified/i).first()).toBeVisible();
  });

  test("C2 save typed text option creates a personal diagnosis", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await openSectionByTitle(doctor, /3\. Diagnosis/i);
    const unique = `E2E my dx ${Date.now().toString(36)}`;
    const box = doctor.getByRole("combobox", { name: /Diagnosis \(search ICD-10/ });
    await box.fill(unique);
    const saveOpt = doctor.getByRole("option", { name: new RegExp(`Save "${unique}" to my diagnoses`) });
    await expect(saveOpt).toBeVisible();
    await saveOpt.click();
    await expect(doctor.getByText(new RegExp(unique)).first()).toBeVisible({ timeout: 15_000 });
  });

  test("C3 one Manage link per section", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await openSectionByTitle(doctor, /1\. Clinical notes/i);
    await expect(doctor.getByRole("link", { name: /Manage/ })).toHaveCount(1);
    await openSectionByTitle(doctor, /3\. Diagnosis/i);
    await expect(doctor.getByRole("link", { name: /Manage/ })).toHaveCount(1);
    await expect(doctor.getByRole("link", { name: /^Manage$/ })).toHaveCount(1);
    await openSectionByTitle(doctor, /7\. Medical Certificate/i);
    await expect(doctor.getByRole("link", { name: /Manage/ })).toHaveCount(1);
  });

  test("C4 no Saved at banner on open without a change", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await expect(doctor.getByText(/Saved at /)).toHaveCount(0);
    await openSectionByTitle(doctor, /3\. Diagnosis/i);
    await expect(doctor.getByText(/Saved at /)).toHaveCount(0);
    await expect(doctor.getByTestId("consult-inline-saved")).toHaveCount(0);
  });

  test("C5 no Review section buttons", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await expect(doctor.getByRole("button", { name: /Review section/ })).toHaveCount(0);
    await expect(doctor.getByRole("button", { name: /Review notes/ })).toHaveCount(0);
    await openSectionByTitle(doctor, /3\. Diagnosis/i);
    await expect(doctor.getByRole("button", { name: /Review section/ })).toHaveCount(0);
    await openSectionByTitle(doctor, /6\. Follow-up/i);
    await expect(doctor.getByRole("button", { name: /Review section/ })).toHaveCount(0);
  });

  test("C6 Vaccinations and Professional Fee sit behind More; tab bar does not scroll", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await doctor.setViewportSize({ width: 1280, height: 800 });
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await expect(steps.getByRole("button", { name: /Vaccinations/ })).toHaveCount(0);
    await expect(steps.getByRole("button", { name: /Professional Fee/ })).toHaveCount(0);
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await expect(steps.getByRole("button", { name: /Vaccinations/ })).toBeVisible();
    await expect(steps.getByRole("button", { name: /Professional Fee/ })).toBeVisible();
    const box = await steps.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(box.sw).toBeLessThanOrEqual(box.cw);
  });
});
//JJQR - END

//JJQR - AI (Nov 20, 2026) F1–F4
test.describe("Consultation2 simplify F1–F4 professional fee", () => {
  async function openFreshConsult(as: (role: Role) => Promise<Page>, api: (role: Role) => Promise<APIRequestContext>) {
    const staffApi = await api("staff");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const ticket = await checkInWalkIn(staffApi, patient.patient_id);
    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
    return doctor;
  }

  test("F1 completed view has a read-only Professional fee line; Edit opens section 9; no Save fee decision", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await fillRequiredConsultFields(doctor);
    await completeConsultFromUi(doctor);
    await expect(doctor.getByText("Professional fee: Decide at desk")).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Save fee decision" })).toHaveCount(0);
    await doctor.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(doctor.getByRole("heading", { name: "Amend consultation" })).toBeVisible();
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await expect(steps.getByRole("button", { name: /Professional Fee/ })).toBeVisible();
    await expect(doctor.getByText("Appointment type")).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Decide at desk" })).toBeVisible();
  });
});
//JJQR - END
