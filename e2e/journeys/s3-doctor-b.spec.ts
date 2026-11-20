import { test, expect } from "../support/fixtures";
import type { APIRequestContext, Page } from "@playwright/test";
import { createTaggedPatient, getRxGroups } from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/** COVERAGE-PLAN §3 · Doctor: patient list, patient chart tabs, prescription create/edit page */

async function seedVisit(
  { api, tag, cleanup }: { api: (r: "staff" | "doctor") => Promise<APIRequestContext>; tag: (l?: string) => string; cleanup: (f: () => unknown) => void },
  label: string, opts: { rx?: boolean; vaccine?: string; complaint?: string } = {},
) {
  const staff = await api("staff");
  const doctor = await api("doctor");
  const name = tag(label);
  const p = await createTaggedPatient(staff, name);
  const v = await completeVisitViaApi({ staff, doctor }, p.patient_id, opts);
  cleanup(() => settleViaApi(staff, v.booking_id));
  return { staff, doctor, name, p, v };
}

test.describe("/doctor/patients", () => {
  test("search by name and by code; 'Open chart' goes to that patient; a nonsense search finds nobody", async ({ as, api, tag, cleanup }) => {
    // the list only holds patients who have a booking with this doctor
    const { name, p } = await seedVisit({ api, tag, cleanup }, "dp-s");
    const page = await as("doctor");
    await page.goto("/doctor/patients");
    await expect(page.getByText(/^\d+ patients?$/)).toBeVisible();
    const box = page.getByRole("searchbox", { name: "Find a patient" });
    const row = page.getByRole("row", { name: new RegExp(name, "i") });
    await box.fill(name);
    await expect(row).toHaveCount(1);
    await box.fill(p.patient_code);
    await expect(row).toHaveCount(1);
    await row.getByRole("link", { name: "Open chart" }).click();
    await expect(page).toHaveURL(new RegExp(`/doctor/patients/${p.patient_id}`));
    await page.goBack();
    await page.getByRole("searchbox", { name: "Find a patient" }).fill(`zz-nobody-${tag("n")}`);
    await expect(page.getByRole("row", { name: /MF-/ })).toHaveCount(0);
  });
});

test.describe("/doctor/patients/[id] · chart", () => {
  test("tabs show the visit: Timeline, Appointments, Consultations, Vitals, Prescriptions, Vaccinations", async ({ as, api, tag, cleanup }) => {
    const s = await seedVisit({ api, tag, cleanup }, "dp-chart", { rx: true, vaccine: "Influenza", complaint: "E2E chart complaint" });
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(s.name, "i"));
    await expect(page.getByText(s.p.patient_code)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Completed").first()).toBeVisible();
    await page.getByRole("tab", { name: "Appointments" }).click();
    await expect(page.getByText("Completed").first()).toBeVisible();
    await page.getByRole("tab", { name: "Consultations" }).click();
    await expect(page.getByRole("button", { name: /E2E chart complaint/ })).toBeVisible();
    await expect(page.getByText("E2E acute pharyngitis")).toBeVisible();
    await page.getByRole("tab", { name: "Vitals" }).click();
    await expect(page.getByText(/118\/76 mmHg/).first()).toBeVisible();
    await page.getByRole("tab", { name: "Prescriptions" }).click();
    await expect(page.getByText("1 medicine")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print prescription" })).toBeVisible();
    await page.getByRole("tab", { name: "Vaccinations" }).click();
    await expect(page.getByRole("row", { name: /Influenza 1 .* Administered/ })).toBeVisible();
  });

  test("Vitals: List ↔ Table view and Newest/Oldest sort work", async ({ as, api, tag, cleanup }) => {
    const s = await seedVisit({ api, tag, cleanup }, "dp-vit");
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}`);
    await page.getByRole("tab", { name: "Vitals" }).click();
    await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Table view" }).click();
    await expect(page.getByRole("button", { name: "Table view" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("118/76").first()).toBeVisible();
    const sort = page.locator("select").filter({ hasText: "Oldest first" });
    await sort.selectOption({ label: "Oldest first" });
    await expect(sort.locator("option:checked")).toHaveText("Oldest first");
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
  });

  test("Lab Results and Documents tabs show an empty state for a patient with none", async ({ as, api, tag }) => {
    const staff = await api("staff");
    const p = await createTaggedPatient(staff, tag("dp-empty"));
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${p.patient_id}`);
    for (const t of ["Lab Results", "Documents", "Vaccinations", "Prescriptions"]) {
      await page.getByRole("tab", { name: t }).click();
      await expect(page.getByRole("tab", { name: t })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(/no |nothing|none|empty/i).first(), t).toBeVisible();
    }
  });

  test("an unknown patient id is a not-found page", async ({ as, guard }) => {
    guard.allow(/\/api\/patients\/0000/);
    const page = await as("doctor");
    await page.goto("/doctor/patients/00000000-0000-0000-0000-000000000abc");
    await expect(page.getByText(/not found|couldn.t find|doesn.t exist|404|unavailable/i).first()).toBeVisible();
  });
});

test.describe("/doctor/patients/[id]/prescriptions · create and edit", () => {
  const medication = (page: Page) => page.getByRole("textbox", { name: "Medication", exact: true });
  async function addItem(page: Page, med: string, qty: string, dosage = "500 mg") {
    await medication(page).fill(med);
    await page.getByRole("textbox", { name: "Dosage / strength" }).fill(dosage);
    await page.getByRole("textbox", { name: "Quantity" }).fill(qty);
    await page.getByRole("button", { name: "Add Item" }).click();
  }

  test("'Add Item' needs a medication and a quantity; a typed item is listed; the same item twice → 'Item already exist.'", async ({ as, api, tag, cleanup }) => {
    const s = await seedVisit({ api, tag, cleanup }, "rx-add");
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}/prescriptions/create?bookingId=${s.v.booking_id}`);
    const add = page.getByRole("button", { name: "Add Item" });
    await expect(add).toBeDisabled();
    await medication(page).fill("E2E-Paracetamol");
    await expect(add, "medication only").toBeDisabled();
    await page.getByRole("textbox", { name: "Quantity" }).fill("10");
    await expect(add).toBeEnabled();
    await medication(page).fill("");
    await expect(add, "quantity only").toBeDisabled();
    await addItem(page, "E2E-Paracetamol", "10");
    await expect(page.getByRole("heading", { name: "Prescription items (1)" })).toBeVisible();
    await addItem(page, "E2E-Paracetamol", "10");
    await expect(page.getByText("Item already exist.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prescription items (1)" })).toBeVisible();
  });

  test("save: confirm dialog lists the item with its Sig preview; 'Go Back' saves nothing; 'Confirm & Save' stores it once even on a double-click", async ({ as, api, tag, cleanup }) => {
    const s = await seedVisit({ api, tag, cleanup }, "rx-save");
    const before = (await getRxGroups(s.doctor, s.p.patient_id)).length;
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}/prescriptions/create?bookingId=${s.v.booking_id}`);
    await medication(page).fill("E2E-Cetirizine");
    await page.getByRole("textbox", { name: "Dosage / strength" }).fill("10 mg");
    await page.getByRole("textbox", { name: "Quantity" }).fill("7");
    await page.getByRole("button", { name: "After" }).click();
    await page.getByRole("button", { name: "Dinner" }).click();
    await page.getByRole("button", { name: "Days" }).click();
    await page.getByRole("textbox", { name: "Indication (e.g. for fever, for cough)" }).fill("for allergy");
    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByRole("button", { name: "Save prescription" }).click();
    const d = page.getByRole("dialog", { name: "Confirm Prescription" });
    await expect(d).toContainText("E2E-Cetirizine");
    await expect(d).toContainText("#7");
    await expect(d).toContainText("Sig preview");
    await d.getByRole("button", { name: "Go Back" }).click();
    expect((await getRxGroups(s.doctor, s.p.patient_id)).length).toBe(before);
    await page.getByRole("button", { name: "Save prescription" }).click();
    await d.getByRole("button", { name: /Confirm/ }).dblclick();
    await page.waitForURL(/tab=prescriptions/);
    const groups = await getRxGroups(s.doctor, s.p.patient_id);
    const mine = JSON.stringify(groups);
    expect(mine).toContain("E2E-Cetirizine");
    expect((mine.match(/E2E-Cetirizine/g) ?? []).length, "one item stored, not two").toBe(1);
  });

  test("'Save these medications as a reusable template' needs a title ('Template title required!')", async ({ as, api, tag, cleanup }) => {
    const s = await seedVisit({ api, tag, cleanup }, "rx-tpl");
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}/prescriptions/create?bookingId=${s.v.booking_id}`);
    await addItem(page, "E2E-Loratadine", "5");
    await page.getByRole("button", { name: "Save these medications as a reusable template" }).click();
    await page.getByRole("button", { name: "Save prescription" }).click();
    await expect(page.getByText("Template title required!")).toBeVisible();
  });

  test("a medication the patient is allergic to cannot be added", async ({ as, api, tag, cleanup }) => {
    test.fail(true, "BUG-28: the standalone prescription pages (/doctor/patients/[id]/prescriptions/create and /[id]) do not pass the patient's allergies to PrescriptionForm, so the allergy block never fires there (it does inside the consultation)");
    const s = await seedVisit({ api, tag, cleanup }, "rx-allergy");
    const put = await s.doctor.put(`/api/patients/${s.p.patient_id}/allergies`, { data: [{ allergen: "Penicillin", reaction: "Rash", severity: "Moderate", is_nkda: false }] });
    expect(put.ok(), await put.text()).toBeTruthy();
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}/prescriptions/create?bookingId=${s.v.booking_id}`);
    await addItem(page, "Penicillin V", "10");
    await expect(page.getByRole("heading", { name: "Prescription items (1)" })).toHaveCount(0);
  });

  test("editing an existing prescription: change the dose, save, and the new dose is stored", async ({ as, api, tag, cleanup }) => {
    const s = await seedVisit({ api, tag, cleanup }, "rx-edit", { rx: true });
    const groupId = s.v.rx_group_id!;
    const page = await as("doctor");
    await page.goto(`/doctor/patients/${s.p.patient_id}/prescriptions/${groupId}`);
    await expect(page.getByRole("heading", { name: "Edit prescription" })).toBeVisible();
    await page.getByRole("button", { name: "Edit item" }).click();
    const edit = page.getByRole("dialog", { name: "Edit Prescription" });
    await edit.getByRole("textbox", { name: "Dosage / strength" }).fill("E2E-250 mg");
    await edit.getByRole("button", { name: "Save", exact: true }).click();
    await expect(edit).toBeHidden();
    await page.getByRole("button", { name: "Save prescription" }).click();
    await page.getByRole("dialog", { name: "Confirm Prescription" }).getByRole("button", { name: /Confirm/ }).click();
    await page.waitForURL(/tab=prescriptions/);
    expect(JSON.stringify(await getRxGroups(s.doctor, s.p.patient_id))).toContain("E2E-250 mg");
  });
});
