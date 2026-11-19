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

  test("every Rx row has Edit and a Mine/System pill; System edit saves your own copy, Mine edits in place; modal is wide with no clipping", async ({ as, api }) => {
    const doctor = await openRxTemplates(as, api);
    const systemRow = doctor.getByRole("button", { name: "Fever work-up", exact: true }).locator("xpath=..");
    await expect(systemRow.getByText("System", { exact: true })).toBeVisible();
    await expect(systemRow.getByRole("button", { name: /^Edit Fever work-up/ })).toBeVisible();
    await expect(systemRow.getByRole("button", { name: /^Delete/ })).toHaveCount(0);

    // System: Edit opens a copy (note + "Copy of ..."), and saving adds a Mine row without touching the System one
    await systemRow.getByRole("button", { name: /^Edit Fever work-up/ }).click();
    const dialog = doctor.getByRole("dialog", { name: "Edit Template" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("note")).toContainText("Editing your own copy of a System template.");
    await expect(dialog.getByLabel("Template Title")).toHaveValue("Copy of Fever work-up");

    // wide modal, nothing clipped, no stray horizontal scroll
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeGreaterThan(900);
    expect(box.width).toBeLessThanOrEqual(962);
    const medication = dialog.getByPlaceholder("Medication — pick from the list or just type it");
    const med = (await medication.boundingBox())!;
    expect(med.width).toBeGreaterThan(300);
    const noHScroll = await dialog.evaluate((d) => [...d.querySelectorAll("*")].every((el) => !(el instanceof HTMLElement) || getComputedStyle(el).overflowX === "visible" || el.scrollWidth <= el.clientWidth + 1));
    expect(noHScroll).toBe(true);
    const slots = ["Breakfast", "Lunch", "Dinner", "Bedtime"].map((n) => dialog.getByRole("button", { name: n, exact: true }));
    const rects = await Promise.all(slots.map((b) => b.boundingBox()));
    for (let i = 1; i < rects.length; i++) {
      const a = rects[i - 1]!, b = rects[i]!;
      const overlap = a.y < b.y + b.height && b.y < a.y + a.height && a.x < b.x + b.width && b.x < a.x + a.width;
      expect(overlap, `timing chips ${i - 1} and ${i} must not overlap`).toBe(false);
    }
    await dialog.getByRole("button", { name: "Save my copy" }).click();
    await expect(dialog).toBeHidden();
    const copyRow = doctor.getByRole("button", { name: "Copy of Fever work-up", exact: true }).locator("xpath=..");
    await expect(copyRow.getByText("Mine", { exact: true })).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Fever work-up", exact: true })).toHaveCount(1);

    // Mine: Edit in place (rename), no extra row; Delete exists
    const renamed = `My fever kit ${Date.now().toString(36)}`;
    await expect(copyRow.getByRole("button", { name: /^Delete/ })).toBeVisible();
    await copyRow.getByRole("button", { name: /^Edit Copy of Fever work-up/ }).click();
    const dialog2 = doctor.getByRole("dialog", { name: "Edit Template" });
    await expect(dialog2.getByRole("note")).toHaveCount(0);
    await dialog2.getByLabel("Template Title").fill(renamed);
    await dialog2.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog2).toBeHidden();
    await expect(doctor.getByRole("button", { name: renamed, exact: true })).toHaveCount(1);
    await expect(doctor.getByRole("button", { name: "Copy of Fever work-up", exact: true })).toHaveCount(0);
  });

  test("iPad portrait: the Edit Template modal stacks its columns and uses the full width", async ({ as, api }) => {
    const doctor = await openRxTemplates(as, api);
    await doctor.setViewportSize({ width: 820, height: 1180 });
    await doctor.getByRole("button", { name: /^Edit Fever work-up/ }).click();
    const dialog = doctor.getByRole("dialog", { name: "Edit Template" });
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeGreaterThan(740);
    const title = (await dialog.getByLabel("Template Title").boundingBox())!;
    const med = (await dialog.getByPlaceholder("Medication — pick from the list or just type it").boundingBox())!;
    expect(Math.abs(title.x - med.x)).toBeLessThan(4); // stacked, not side by side
    expect(med.width).toBeGreaterThan(500);
  });

  test("/doctor/templates Rx tab: Edit on a System set makes and opens your own copy", async ({ as }) => {
    const doctor = await as("doctor");
    await doctor.goto("/doctor/templates?tab=rx");
    const row = doctor.getByText("Hypertension follow-up", { exact: true }).first().locator("xpath=ancestor::*[.//button[normalize-space()='Edit']][1]");
    await row.getByRole("button", { name: "Edit", exact: true }).first().click();
    await expect(doctor.getByText("Editing your own copy of a System template.")).toBeVisible();
    await expect(doctor.locator("input[value^='Copy of Hypertension follow-up']")).toBeVisible();
  });
});
//JJQR - END
