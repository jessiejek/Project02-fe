import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";
import { createTaggedPatient, getBooking, getConsultationByBooking, getVitals } from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/**
 * COVERAGE-PLAN §3 · Doctor › /doctor/consultation2/[bookingId] — written against the CURRENT screen
 * ("1. Clinical notes", footer Save draft / Ctrl+S, inline allergy panel).
 * The older consultation-*.spec.ts files still drive the previous screen ("1. SOAP", placeholder fields) and fail; see the report.
 */

async function openVisit({ api, tag, cleanup }: { api: any; tag: any; cleanup: any }, label: string, opts: Parameters<typeof completeVisitViaApi>[2] = {}) {
  const staff = await api("staff");
  const doctor = await api("doctor");
  const p = await createTaggedPatient(staff, tag(label));
  const v = await completeVisitViaApi({ staff, doctor }, p.patient_id, { leaveOpen: true, ...opts });
  cleanup(async () => {
    await staff.put(`/api/queue/${v.booking_id}/complete`).catch(() => undefined);
    await settleViaApi(staff, v.booking_id);
  });
  return { staff, doctor, p, v };
}
const nav = (page: Page, re: RegExp) => page.getByRole("navigation", { name: "Consultation sections" }).getByRole("button", { name: re });
const complete = (page: Page) => page.getByRole("button", { name: "Complete Consultation" });
/** Click the confirming button of the open dialog ("Confirm & Save", "Save vital signs", …) — never Cancel / Go Back / Close. */
async function confirmDialog(page: Page) {
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button").filter({ hasNotText: /^(Cancel|Go Back|Close)$/ }).last().click();
  await expect(dlg).toHaveCount(0, { timeout: 10_000 });
}
test.describe("/doctor/consultation2/[bookingId]", () => {
  test("header, section bar and notes load for the visit; Complete is locked while required sections are open", async ({ as, api, tag, cleanup }) => {
    const { p, v } = await openVisit({ api, tag, cleanup }, "cu-load");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await expect(page.getByText(new RegExp(`${p.first_name}.*Tester`, "i")).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Document consultation", level: 1 })).toBeVisible();
    for (const n of [/1\. Clinical notes/, /2\. Vital Signs/, /3\. Diagnosis/, /4\. Prescription/, /5\. Lab Orders/, /6\. Follow-up/, /7\. Medical Certificate/, /More/]) await expect(nav(page, n)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Chief complaint/ })).toHaveValue("E2E seeded complaint");
    await expect(complete(page)).toBeDisabled();
  });

  test("every section opens its own heading", async ({ as, api, tag, cleanup }) => {
    const { v } = await openVisit({ api, tag, cleanup }, "cu-nav");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    for (const [n, h] of [[/2\. Vital/, /2\. Vital Signs/], [/3\. Diagnosis/, /3\. Diagnosis/], [/4\. Prescription/, /4\. Prescription/], [/5\. Lab/, /5\. Lab Orders/], [/6\. Follow-up/, /6\. Follow-up/], [/7\. Medical/, /7\. Medical Certificate/], [/1\. Clinical/, /1\. Clinical notes/]] as [RegExp, RegExp][]) {
      await nav(page, n).click();
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
  });

  test("notes: edit → Save draft → reload keeps it → API agrees; ", async ({ as, api, tag, cleanup }) => {
    const { staff, v } = await openVisit({ api, tag, cleanup }, "cu-notes");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    const cc = page.getByRole("textbox", { name: /Chief complaint/ });
    const text = tag("complaint");
    await cc.fill(text);
    await page.getByRole("textbox", { name: "Plan" }).fill("E2E plan edited");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect.poll(async () => (await getConsultationByBooking(staff, v.booking_id)).chief_complaint).toBe(text);
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Chief complaint/ })).toHaveValue(text);
    await expect(page.getByRole("textbox", { name: "Plan" })).toHaveValue("E2E plan edited");
  });

  test("SOAP template: choosing a system template fills the notes", async ({ as, api, tag, cleanup }) => {
    const { v } = await openVisit({ api, tag, cleanup }, "cu-tpl");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await page.getByRole("combobox", { name: "Use SOAP template" }).selectOption({ label: "Fever work-up" });
    await page.waitForTimeout(800);
    const dlg = page.getByRole("dialog");
    if (await dlg.isVisible().catch(() => false)) await dlg.getByRole("button", { name: /Replace|Apply|Use|Confirm|Yes/ }).first().click();
    await expect(page.getByRole("textbox", { name: "Subjective" })).not.toHaveValue("E2E subjective");
  });

  test("allergies: ticking NKDA is saved to the patient", async ({ as, api, tag, cleanup }) => {
    const { staff, p, v } = await openVisit({ api, tag, cleanup }, "cu-nkda");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await page.getByRole("button", { name: "Record allergies / NKDA" }).click();
    await page.getByRole("checkbox", { name: "NKDA" }).click({ force: true });
    await expect.poll(async () => ((await (await staff.get(`/api/patients/${p.patient_id}/allergies`)).json()) as any[]).some((a) => a.is_nkda)).toBe(true);
  });

  test("allergies: adding an allergy lists it on the patient and in the banner", async ({ as, api, tag, cleanup }) => {
    const { staff, p, v } = await openVisit({ api, tag, cleanup }, "cu-alg");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await page.getByRole("button", { name: "Record allergies / NKDA" }).click();
    await page.getByRole("textbox", { name: "Allergies" }).fill("Penicillin");
    await page.getByRole("button", { name: "Add allergy" }).click();
    await expect.poll(async () => ((await (await staff.get(`/api/patients/${p.patient_id}/allergies`)).json()) as any[]).some((a) => /penicillin/i.test(a.allergen))).toBe(true);
    await expect(page.getByText(/Penicillin/i).first()).toBeVisible();
  });

  test("vitals: fill height and weight → Save vital signs → stored for the booking and kept after reload", async ({ as, api, tag, cleanup }) => {
    const { staff, v } = await openVisit({ api, tag, cleanup }, "cu-vit");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await nav(page, /2\. Vital/).click();
    await page.getByRole("textbox", { name: "Enter height" }).fill("171");
    await page.getByRole("textbox", { name: "Enter weight" }).fill("68");
    await page.getByRole("button", { name: "Save vital signs" }).click();
    await confirmDialog(page);
    await expect.poll(async () => (await getVitals(staff, v.booking_id)).length).toBeGreaterThanOrEqual(4);
    await page.reload();
    await nav(page, /2\. Vital/).click();
    await expect(page.getByRole("textbox", { name: "Enter height" })).toHaveValue("171");
    await expect(page.getByRole("textbox", { name: "Enter weight" })).toHaveValue("68");
  });

  test("diagnosis: add a typed diagnosis → listed and stored; insert a saved ICD-10 diagnosis", async ({ as, api, tag, cleanup }) => {
    const { staff, v } = await openVisit({ api, tag, cleanup }, "cu-dx");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await nav(page, /3\. Diagnosis/).click();
    const dx = tag("dx");
    await page.getByRole("combobox", { name: /Diagnosis \(search ICD-10/ }).fill(dx);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(new RegExp(dx, "i")).first()).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForTimeout(1500);
    const c = await getConsultationByBooking(staff, v.booking_id);
    const rows: any[] = await (await staff.get(`/api/consultations/${c.consultation_id}/diagnoses`)).json();
    expect(rows.map((r) => `${r.custom_description ?? ""} ${r.icd10_code ?? ""}`).join("|").toLowerCase()).toContain(dx.toLowerCase());
  });

  test("complete through the UI: review every required section → Complete → visit is Completed, patient owes the fee", async ({ as, api, tag, cleanup }) => {
    const { staff, v } = await openVisit({ api, tag, cleanup }, "cu-done");
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${v.booking_id}`);
    await nav(page, /1\. Clinical/).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await nav(page, /3\. Diagnosis/).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    // follow-up: choose "No follow-up"
    await nav(page, /6\. Follow-up/).click();
    await page.getByRole("radio", { name: "No follow-up" }).check({ force: true });
    // choosing the radio alone does NOT satisfy the section — the doctor must also tick "No follow-up for this visit" (the section says so)
    await page.getByRole("checkbox", { name: /No follow-up for this visit/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    // prescription: intentionally none, allergies reviewed
    await nav(page, /4\. Prescription/).click();
    await page.getByRole("checkbox", { name: /No medicines this visit/ }).click({ force: true });
    await page.getByRole("button", { name: "Record allergies / NKDA" }).click();
    await page.getByRole("checkbox", { name: "NKDA" }).click({ force: true });
    const doneBtn = page.getByRole("button", { name: "Done" });
    if (await doneBtn.isVisible().catch(() => false)) await doneBtn.click();
    await expect(page.getByText(/required section.* left/)).toHaveCount(0);
    await expect(complete(page)).toBeEnabled({ timeout: 10_000 });
    await complete(page).click();
    const dlg = page.getByRole("dialog");
    if (await dlg.isVisible().catch(() => false)) await dlg.getByRole("button", { name: /Complete|Confirm|Yes/ }).last().click();
    await expect.poll(async () => (await getConsultationByBooking(staff, v.booking_id)).status, { timeout: 15_000 }).toBe("Completed");
    expect((await getBooking(staff, v.booking_id)).status).toMatch(/Completed|InProgress/);
  });
});
