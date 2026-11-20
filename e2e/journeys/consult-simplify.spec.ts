import type { APIRequestContext } from "@playwright/test";
import { test, expect, type Page } from "../support/fixtures";
import { checkInWalkIn, createPatient, type Role } from "../support/api";
import { completeConsultFromUi, fillRequiredConsultFields, openSectionByTitle } from "../support/consultation-flow";
import { completeVisitViaApi } from "../support/visit";

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

//JJQR - AI (Nov 20, 2026) F1–F5
test.describe("Consultation2 simplify F1–F5 professional fee", () => {
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
    await expect(doctor.getByText(/Professional fee: Charge ₱/)).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Save fee decision" })).toHaveCount(0);
    await doctor.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(doctor.getByRole("heading", { name: "Amend consultation" })).toBeVisible();
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await expect(steps.getByRole("button", { name: /Professional Fee/ })).toBeVisible();
    await expect(doctor.getByText("Appointment type")).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Decide at desk" })).toBeVisible();
  });

  test("F2 section 9 labels are Charge, Waive, Decide at desk", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByRole("button", { name: "Charge", exact: true })).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Waive", exact: true })).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Decide at desk", exact: true })).toBeVisible();
    await expect(doctor.getByRole("button", { name: "Charge PF" })).toHaveCount(0);
    await expect(doctor.getByRole("button", { name: "Waive PF" })).toHaveCount(0);
  });

  test("F3 follow-up with med cert shows Total: ₱400 (Follow-up ₱350 + Medical certificate ₱50)", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await doctor.getByRole("button", { name: "Follow-up visit" }).click();
    await openSectionByTitle(doctor, /7\. Medical Certificate/i);
    await doctor.getByPlaceholder(/Recommendations/).fill("Rest 3 days");
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByText("Total: ₱400 (Follow-up ₱350 + Medical certificate ₱50)")).toBeVisible();
    await expect(doctor.getByText("Computed clinic fee")).toHaveCount(0);
  });

  test("F4 Charge ₱400 still shows after reload in the read-only line and section 9", async ({ as, api }) => {
    const staffApi = await api("staff");
    const doctorApi = await api("doctor");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const visit = await completeVisitViaApi({ staff: staffApi, doctor: doctorApi }, patient.patient_id, {
      pfDecision: "Charge",
      pfAmount: 400,
    });
    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${visit.booking_id}`);
    await expect(doctor.getByText("Professional fee: Charge ₱400")).toBeVisible();
    await doctor.reload();
    await expect(doctor.getByText("Professional fee: Charge ₱400")).toBeVisible();
    await doctor.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(doctor.getByRole("heading", { name: "Amend consultation" })).toBeVisible();
    await expect(doctor.getByRole("textbox", { name: "Amount" })).toHaveValue("400");
  });

  test("F5 new visit section 9 defaults to Charge with Amount = Total; saved Waive reloads as Waive", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByRole("textbox", { name: "Amount" })).toBeVisible();
    const totalLine = doctor.getByText(/^Total: ₱\d+/);
    await expect(totalLine).toBeVisible({ timeout: 15_000 });
    const summary = await totalLine.innerText();
    const total = /Total: ₱([\d,]+)/.exec(summary)?.[1]?.replace(/,/g, "");
    expect(total).toBeTruthy();
    await expect(doctor.getByRole("textbox", { name: "Amount" })).toHaveValue(total!);

    const staffApi = await api("staff");
    const doctorApi = await api("doctor");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const visit = await completeVisitViaApi({ staff: staffApi, doctor: doctorApi }, patient.patient_id, {
      pfDecision: "Waive",
      pfReason: "Indigent patient",
    });
    await doctor.goto(`/doctor/consultation2/${visit.booking_id}`);
    await expect(doctor.getByText("Professional fee: Waive — Indigent patient")).toBeVisible();
    await doctor.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(doctor.getByRole("heading", { name: "Amend consultation" })).toBeVisible();
    await expect(doctor.getByRole("textbox", { name: /Reason \(minimum 5 characters\)/ })).toHaveValue("Indigent patient");
    await expect(doctor.getByRole("textbox", { name: "Amount" })).toHaveCount(0);
  });
});
//JJQR - END

//JJQR - AI (Nov 20, 2026) E1
test.describe("Consultation2 simplify E1–E5 medical certificate", () => {
  async function openFreshConsult(as: (role: Role) => Promise<Page>, api: (role: Role) => Promise<APIRequestContext>) {
    const staffApi = await api("staff");
    const patient = await createPatient(staffApi, Date.now().toString(36));
    const ticket = await checkInWalkIn(staffApi, patient.patient_id);
    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
    return doctor;
  }

  test("E1 fields prefilled (examined at = clinic name, exam date = today, doctor license shown, address hint)", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await openSectionByTitle(doctor, /7\. Medical Certificate/i);
    await expect(doctor.getByRole("textbox", { name: /Examined at/i })).toHaveValue(/Grace Medical Clinic/, { timeout: 15_000 });
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await expect(doctor.getByLabel(/Examination from/i)).toHaveValue(today);
    await expect(doctor.getByText(/License No\./)).toBeVisible();
    await expect(doctor.getByPlaceholder("No address on file")).toBeVisible();
  });

  test("E2 apply template keeps examined at and diagnosis", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await openSectionByTitle(doctor, /3\. Diagnosis/i);
    const box = doctor.getByRole("combobox", { name: /Diagnosis \(search ICD-10/ });
    await box.fill("Acute pharyngitis");
    await doctor.getByRole("button", { name: "Add", exact: true }).click();
    await expect(doctor.getByText(/Acute pharyngitis/).first()).toBeVisible();
    await openSectionByTitle(doctor, /7\. Medical Certificate/i);
    const examined = doctor.getByRole("textbox", { name: /Examined at/i });
    await expect(examined).toHaveValue(/Grace Medical Clinic/, { timeout: 15_000 });
    const dx = doctor.getByRole("textbox", { name: /Diagnosis \/ Impressions/ });
    await expect(dx).toHaveValue(/Acute pharyngitis/);
    const examinedBefore = await examined.inputValue();
    const dxBefore = await dx.inputValue();
    const tpl = doctor.getByLabel("Use certificate template");
    await expect(tpl).toBeVisible({ timeout: 15_000 });
    const option = tpl.locator("option").filter({ hasText: /Medical clearance/i }).first();
    const value = await option.getAttribute("value");
    expect(value).toBeTruthy();
    await tpl.selectOption(value!);
    await expect(doctor.getByPlaceholder(/Recommendations/)).not.toHaveValue("");
    await expect(examined).toHaveValue(examinedBefore);
    await expect(dx).toHaveValue(dxBefore);
    await expect(dx).not.toHaveValue(/No active contagious disease/i);
  });

  test("E4 issuing a certificate turns the fee add-on on; removing turns it off", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    await doctor.getByRole("button", { name: "Follow-up visit" }).click();
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByText("Total: ₱350 (Follow-up ₱350)")).toBeVisible();
    await openSectionByTitle(doctor, /7\. Medical Certificate/i);
    await doctor.getByPlaceholder(/Recommendations/).fill("Rest 3 days");
    await doctor.getByRole("button", { name: "Save without printing" }).click();
    await doctor.getByRole("dialog", { name: /Confirm Medical Certificate/ }).getByRole("button", { name: /Confirm & Save/ }).click();
    await expect(doctor.getByRole("dialog", { name: /Confirm Medical Certificate/ })).toHaveCount(0, { timeout: 15_000 });
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByText("Total: ₱400 (Follow-up ₱350 + Medical certificate ₱50)")).toBeVisible();
    await expect(doctor.getByText(/Medical certificate \+₱50 — included because a certificate was issued/)).toBeVisible();
    await openSectionByTitle(doctor, /7\. Medical Certificate/i);
    await doctor.getByRole("button", { name: "Remove certificate" }).click();
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByText("Total: ₱350 (Follow-up ₱350)")).toBeVisible();
    await expect(doctor.getByText(/included because a certificate was issued/)).toHaveCount(0);
  });

  test("E5 Medical Certificate link in professional fee opens that section", async ({ as, api }) => {
    const doctor = await openFreshConsult(as, api);
    const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
    await steps.getByRole("button", { name: "More", exact: true }).click();
    await openSectionByTitle(doctor, /Professional Fee/i);
    await expect(doctor.getByText(/section 8/)).toHaveCount(0);
    await doctor.getByRole("button", { name: "Medical Certificate", exact: true }).click();
    await expect(doctor.getByRole("textbox", { name: /Examined at/i })).toBeVisible();
  });
});
//JJQR - END

