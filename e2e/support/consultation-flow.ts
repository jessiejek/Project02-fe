import { expect, type Page } from "@playwright/test";

/** Fill gates required for Complete on consultation2 (Grace clinic). */
export async function fillRequiredConsultFields(page: Page, chiefComplaint = "E2E sore throat") {
  await expandSoapSection(page);
  await page.getByPlaceholder("Chief Complaint*").fill(chiefComplaint);

  await page.getByRole("button", { name: /2\. Vital Signs/ }).first().click();
  await page.getByPlaceholder("Enter blood pressure").fill("118/76");
  await page.getByPlaceholder("Enter pulse rate").fill("72");
  await page.getByPlaceholder("Enter temperature").fill("37.0");
  await page.getByPlaceholder("Enter respiratory rate").fill("16");
  await page.getByPlaceholder("Enter o2 saturation").fill("99");
  await page.getByPlaceholder("Enter weight").fill("65");
  await page.getByPlaceholder("Enter height").fill("165");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(/Vitals saved at/)).toBeVisible();

  await page.getByRole("button", { name: /3\. Diagnosis/ }).first().click();
  const dxInput = page.getByPlaceholder(/Diagnosis \(/);
  await dxInput.fill("Acute pharyngitis");
  const addButtons = page.getByRole("button", { name: "Add", exact: true });
  await ((await addButtons.count()) > 1 ? addButtons.nth(1) : addButtons).click();
  await expect(page.getByText("Acute pharyngitis (Primary)")).toBeVisible();

  await page.getByRole("button", { name: /4\. Prescription/ }).first().click();
  await page.getByText(/No medicines this visit/i).click();

  await page.locator("h3").filter({ hasText: /Follow-up/ }).click();
  await expect(page.getByRole("button", { name: "Select date" })).toBeVisible();
  await page.getByRole("button", { name: "Select date" }).click();
  await page.getByRole("button", { name: "Today" }).click();
}

export async function completeConsultFromUi(page: Page) {
  await page.getByRole("button", { name: "Complete Consultation", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirm & Complete" }).click();
  await expect(page.getByText("Consultation saved")).toBeVisible({ timeout: 20_000 });
}

export async function openCompletedConsult(page: Page, bookingId: string) {
  await page.goto(`/doctor/consultation2/${bookingId}`);
  await expect(page.getByRole("button", { name: "Edit Consultation" })).toBeVisible({ timeout: 30_000 });
}

export async function enterAmendMode(page: Page) {
  await page.getByRole("button", { name: "Edit Consultation" }).click();
  await expect(page.getByText(/Manual save only/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consultation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
}

export async function assertStillInAmendMode(page: Page, contextLabel: string) {
  await expect(page.getByRole("button", { name: "Edit Consultation" }), `${contextLabel}: should not be view-only`).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Changes" }), contextLabel).toBeVisible();
  await expect(page.locator("main").getByRole("button", { name: "Cancel", exact: true }), contextLabel).toBeVisible();
  await expect(page.getByText(/Manual save only/)).toBeVisible();
}

export async function confirmReviewSectionSave(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm & Save" }).click();
}

export async function expandSoapSection(page: Page) {
  await page.getByRole("button", { name: /1\. SOAP/i }).first().click();
  await expect(page.getByPlaceholder("Chief Complaint*")).toBeVisible();
}

export async function clickSoapToolbarSave(page: Page) {
  await page
    .getByRole("button", { name: "Save as Template" })
    .locator("xpath=..")
    .getByRole("button", { name: "Save", exact: true })
    .click();
}

/** Section header Save → review modal → Confirm & Save (amend/complete progress save). */
export async function saveOpenSectionViaReview(page: Page) {
  await page.locator(".mt-md").getByRole("button", { name: "Save", exact: true }).first().click();
  await confirmReviewSectionSave(page);
}

export async function openSectionByTitle(page: Page, titleRe: RegExp) {
  await page.getByRole("button", { name: titleRe }).first().click();
}

export async function showOccasionalSections(page: Page) {
  const toggle = page.getByRole("button", { name: /Show occasional sections/i });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
}
