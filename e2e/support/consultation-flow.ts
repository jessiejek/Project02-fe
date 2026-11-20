import { expect, type Page } from "@playwright/test";

//JJQR - AI (Nov 20, 2026) - batch 2: helpers rewritten for the redesigned /doctor/consultation2 screen
// ("1. Clinical notes" step bar, labelled text boxes, footer "Save draft" / Ctrl+S,
//  "Save vital signs", "Review & complete" (aria "Complete Consultation") → "Completion Checklist" → "Confirm & Complete",
//  amend mode = "Amend consultation" + "Save amendment" + "Cancel amendment").
const stepBar = (page: Page) => page.getByRole("navigation", { name: "Consultation sections" });

/** Open a step in the section bar by its title, e.g. /3\. Diagnosis/. */
export async function openSectionByTitle(page: Page, titleRe: RegExp) {
  await stepBar(page).getByRole("button", { name: titleRe }).first().click();
}

/** Open "1. Clinical notes" and wait for the Chief complaint box. */
export async function expandSoapSection(page: Page) {
  await openSectionByTitle(page, /1\. Clinical notes/i);
  await expect(page.getByRole("textbox", { name: /Chief complaint/i })).toBeVisible();
}

export const chiefComplaintBox = (page: Page) => page.getByRole("textbox", { name: /Chief complaint/i });

/** Click the confirming button of the open dialog (Confirm & Save / Save vital signs / …) — never Cancel / Go Back / Close. */
export async function confirmReviewSectionSave(page: Page) {
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button").filter({ hasNotText: /^(Cancel|Go Back|Close)$/ }).last().click();
  await expect(dlg).toHaveCount(0, { timeout: 15_000 });
}

/** Persist progress: footer Save draft, or Ctrl+S in amend (stays in amend). */
export async function clickSoapToolbarSave(page: Page) {
  const amend = page.getByRole("button", { name: "Save amendment" });
  if (await amend.isVisible().catch(() => false)) {
    await page.keyboard.press("Control+s");
    return;
  }
  await page.getByRole("button", { name: "Save draft" }).click();
}

/** Persist the open section without a Review section button (C5). */
export async function saveOpenSectionViaReview(page: Page) {
  await clickSoapToolbarSave(page);
}

/** Fill every gate required for Complete on consultation2. */
export async function fillRequiredConsultFields(page: Page, chiefComplaint = "E2E sore throat") {
  await expandSoapSection(page);
  await chiefComplaintBox(page).fill(chiefComplaint);

  await openSectionByTitle(page, /2\. Vital Signs/);
  await page.getByRole("textbox", { name: /Enter blood pressure/i }).fill("118/76");
  await page.getByRole("textbox", { name: /Enter pulse rate/i }).fill("72");
  for (const [n, v] of [[/Enter temperature/i, "37.0"], [/Enter respiratory rate/i, "16"], [/Enter o2 saturation/i, "99"], [/Enter weight/i, "65"], [/Enter height/i, "165"]] as [RegExp, string][]) {
    const box = page.getByRole("textbox", { name: n });
    if (await box.count()) await box.first().fill(v);
  }
  await page.getByRole("button", { name: "Save vital signs" }).click();
  await confirmReviewSectionSave(page);

  await openSectionByTitle(page, /3\. Diagnosis/);
  await page.getByRole("combobox", { name: /Diagnosis \(search ICD-10/ }).fill("Acute pharyngitis");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/Acute pharyngitis/).first()).toBeVisible();

  await openSectionByTitle(page, /4\. Prescription/);
  await page.getByRole("checkbox", { name: /No medicines this visit/ }).click({ force: true });

  await markNoFollowUp(page);
}

/** Follow-up step: choose "No follow-up" AND tick "No follow-up for this visit" (the radio alone does not satisfy the step). */
export async function markNoFollowUp(page: Page) {
  await openSectionByTitle(page, /6\. Follow-up/);
  await page.getByRole("radio", { name: "No follow-up" }).check({ force: true });
  await page.getByRole("checkbox", { name: /No follow-up for this visit/ }).check();
}

export async function completeConsultFromUi(page: Page) {
  await expect(page.getByRole("button", { name: "Complete Consultation" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Complete Consultation" }).click();
  await page.getByRole("button", { name: "Confirm & Complete" }).click();
  await expect(page.getByText("Consultation saved")).toBeVisible({ timeout: 20_000 });
}

export async function openCompletedConsult(page: Page, bookingId: string) {
  await page.goto(`/doctor/consultation2/${bookingId}`);
  await expect(page.getByRole("button", { name: "Edit Consultation" })).toBeVisible({ timeout: 30_000 });
}

/**
 * Click "Edit Consultation" and wait for the amend screen.
 * BUG-40: a consultation completed with "No follow-up" (or with no follow-up row at all) re-opens with the Follow-up step unsatisfied, which
 * disables "Save amendment" without saying why. Unless `workaround: false`, this helper
 * re-ticks "No follow-up for this visit" so the tests that are about something else can carry on; the bug itself is asserted in its own test.
 */
export async function enterAmendMode(page: Page, opts: { workaround?: boolean } = {}) {
  await page.getByRole("button", { name: "Edit Consultation" }).click();
  await expect(page.getByText(/Manual save only/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amend consultation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel amendment" })).toBeVisible();
  const save = page.getByRole("button", { name: "Save amendment" });
  if (opts.workaround === false) {
    await expect(save).toBeEnabled({ timeout: 5_000 });
    return;
  }
  await page.waitForTimeout(1_000);
  if (await save.isDisabled()) {
    await markNoFollowUp(page);
    await expandSoapSection(page);
  }
  await expect(save).toBeEnabled({ timeout: 15_000 });
}

export async function assertStillInAmendMode(page: Page, contextLabel: string) {
  await expect(page.getByRole("button", { name: "Edit Consultation" }), `${contextLabel}: should not be view-only`).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save amendment" }), contextLabel).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel amendment" }), contextLabel).toBeVisible();
  await expect(page.getByText(/Manual save only/)).toBeVisible();
}

export async function showOccasionalSections(page: Page) {
  const toggle = stepBar(page).getByRole("button", { name: "More", exact: true });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
}
//JJQR - END

//JJQR - AI (Nov 20, 2026) - amend-persist-all: footer Save amendment exits to view; Ctrl+S stays in amend; Rx helpers never click "Save medications" unless asked
export async function clickSaveAmendment(page: Page) {
  await page.getByRole("button", { name: "Save amendment" }).last().click();
  await expect(page.getByRole("button", { name: "Edit Consultation" })).toBeVisible({ timeout: 20_000 });
}

export async function gotoAmendMode(page: Page, bookingId: string) {
  await page.goto(`/doctor/consultation2/${bookingId}?mode=amend`);
  await expect(page.getByRole("heading", { name: "Amend consultation" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Manual save only/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save amendment" })).toBeEnabled({ timeout: 15_000 });
}

export async function saveAmendViaCtrlS(page: Page) {
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/Amendment saved/).first()).toBeVisible({ timeout: 20_000 });
}

export async function acknowledgeRxAllergyGate(page: Page) {
  const ack = page.getByRole("button", { name: "Acknowledge" });
  if (await ack.isVisible().catch(() => false)) await ack.click();
}

export async function addNewRxLine(page: Page, medication: string, quantity = "10", expectCount = 1) {
  await openSectionByTitle(page, /4\. Prescription/);
  await acknowledgeRxAllergyGate(page);
  await page.getByRole("tab", { name: "New Prescription" }).click();
  await page.getByRole("textbox", { name: "Medication" }).fill(medication);
  await page.getByRole("textbox", { name: "Quantity" }).click();
  await page.getByRole("textbox", { name: "Quantity" }).fill(quantity);
  await page.getByRole("button", { name: "Add Item" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Prescription items \\(${expectCount}\\)`) })).toBeVisible();
}

export async function addRxFromTemplatesTab(page: Page) {
  await openSectionByTitle(page, /4\. Prescription/);
  await acknowledgeRxAllergyGate(page);
  await page.getByRole("tab", { name: "Templates" }).click();
  await page.getByRole("button", { name: "Acute gastroenteritis" }).first().click();
  await expect(page.getByRole("heading", { name: /Prescription items \([1-9]/ })).toBeVisible();
}

export async function saveMedications(page: Page) {
  await page.getByRole("button", { name: "Save medications" }).click();
  await page.getByRole("dialog", { name: /Confirm Prescription/ }).getByRole("button", { name: /Confirm & Save/ }).click();
  await expect(page.getByRole("dialog", { name: /Confirm Prescription/ })).toHaveCount(0, { timeout: 15_000 });
}

export async function removeAllRxItems(page: Page) {
  await openSectionByTitle(page, /4\. Prescription/);
  const selectAll = page.getByRole("checkbox", { name: /Select All/ });
  await expect(selectAll).toBeVisible();
  await selectAll.check();
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(page.getByRole("heading", { name: /Prescription items \(0\)/ })).toBeVisible();
}

export async function addAllergyViaBanner(page: Page, allergen: string) {
  const record = page.getByRole("button", { name: "Record allergies / NKDA" });
  if (await record.isVisible().catch(() => false)) await record.click();
  else await page.locator("button[aria-controls='consult-allergy-editor-panel']").click();
  await expect(page.locator("#consult-allergy-editor-panel")).toBeVisible();
  await page.getByRole("textbox", { name: "Allergies" }).fill(allergen);
  await page.getByRole("button", { name: "Add allergy" }).click();
}

export async function pickFollowUpDate(page: Page): Promise<string> {
  await openSectionByTitle(page, /6\. Follow-up/);
  //JJQR - AI (Nov 20, 2026)
  await page.getByText("Schedule date", { exact: true }).click();
  await page.getByRole("button", { name: "Select date" }).click();
  await page.getByRole("button", { name: "Next month" }).click();
  const day = page.getByRole("dialog", { name: "Choose a date" }).getByRole("button", { name: /^[A-Za-z]+ 15, \d{4}$/ });
  const label = (await day.getAttribute("aria-label")) ?? "";
  await day.click();
  await expect(page.getByRole("button", { name: "Select date" })).toHaveCount(0);
  return label;
}
//JJQR - END
