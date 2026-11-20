//JJQR - AI (Nov 20, 2026) - amend-persist-all: API-seed a completed visit (rx + vaccine) then prove Save amendment / Ctrl+S persist (failing tests are expected for broken sections)
import { test, expect, type Page } from "../support/fixtures";
import {
  createTaggedPatient,
  getConsultationByBooking,
  getLabOrders,
  getMedicalCertificate,
  getPatientAllergies,
  getRxGroups,
  getVaccinations,
  getVitals,
  manilaDate,
  type Role,
} from "../support/api";
import type { APIRequestContext } from "@playwright/test";
import { completeVisitViaApi, settleViaApi } from "../support/visit";
import {
  addAllergyViaBanner,
  addNewRxLine,
  addRxFromTemplatesTab,
  clickSaveAmendment,
  expandSoapSection,
  gotoAmendMode,
  openSectionByTitle,
  pickFollowUpDate,
  removeAllRxItems,
  saveAmendViaCtrlS,
  saveMedications,
  showOccasionalSections,
} from "../support/consultation-flow";

async function seedAndComplete(
  as: (role: Role) => Promise<Page>,
  api: (role: Role) => Promise<APIRequestContext>,
  tag: (l?: string) => string,
  cleanup: (f: () => unknown) => void,
  opts: { rx?: boolean } = {},
) {
  const staff = await api("staff");
  const doctorApi = await api("doctor");
  const label = tag("ap");
  const patient = await createTaggedPatient(staff, label);
  const visit = await completeVisitViaApi({ staff, doctor: doctorApi }, patient.patient_id, {
    rx: opts.rx ?? true,
    vaccine: "E2E vaccine",
  });
  cleanup(async () => {
    await staff.put(`/api/queue/${visit.booking_id}/complete`).catch(() => undefined);
    await settleViaApi(staff, visit.booking_id);
  });
  const doctor = await as("doctor");
  return { doctor, doctorApi, ticket: { booking_id: visit.booking_id }, patient };
}

function dump(v: unknown) {
  return JSON.stringify(v);
}

test.describe("amend-persist-all", () => {
  test.describe.configure({ timeout: 180_000 });

  test("clinical notes: chief complaint + SOAP persist via Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const cc = `E2E amend CC ${tag("soap")}`;
    const soap = {
      subjective: `E2E amend S ${tag("s")}`,
      objective: `E2E amend O ${tag("o")}`,
      assessment: `E2E amend A ${tag("a")}`,
      plan: `E2E amend P ${tag("p")}`,
    };
    await gotoAmendMode(doctor, ticket.booking_id);
    await expandSoapSection(doctor);
    await doctor.getByRole("textbox", { name: /Chief complaint/ }).fill(cc);
    await doctor.getByRole("textbox", { name: "Subjective", exact: true }).fill(soap.subjective);
    await doctor.getByRole("textbox", { name: "Objective", exact: true }).fill(soap.objective);
    await doctor.getByRole("textbox", { name: "Assessment", exact: true }).fill(soap.assessment);
    await doctor.getByRole("textbox", { name: "Plan", exact: true }).fill(soap.plan);
    await clickSaveAmendment(doctor);

    const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
    expect(consult.chief_complaint, "chief_complaint persisted").toBe(cc);
    expect(consult.subjective, "subjective persisted").toBe(soap.subjective);
    expect(consult.objective, "objective persisted").toBe(soap.objective);
    expect(consult.assessment, "assessment persisted").toBe(soap.assessment);
    expect(consult.plan, "plan persisted").toBe(soap.plan);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await expandSoapSection(doctor);
    await expect(doctor.getByRole("textbox", { name: /Chief complaint/ })).toHaveValue(cc);
    await expect(doctor.getByRole("textbox", { name: "Subjective", exact: true })).toHaveValue(soap.subjective);
    await expect(doctor.getByRole("textbox", { name: "Objective", exact: true })).toHaveValue(soap.objective);
    await expect(doctor.getByRole("textbox", { name: "Assessment", exact: true })).toHaveValue(soap.assessment);
    await expect(doctor.getByRole("textbox", { name: "Plan", exact: true })).toHaveValue(soap.plan);
  });

  test("vital signs persist via Save vital signs then Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const bp = "133/85";
    const pulse = "81";
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /2\. Vital Signs/);
    await doctor.getByRole("textbox", { name: /Enter blood pressure/i }).fill(bp);
    await doctor.getByRole("textbox", { name: /Enter pulse rate/i }).fill(pulse);
    await doctor.getByRole("button", { name: "Save vital signs" }).click();
    const dlg = doctor.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button").filter({ hasNotText: /^(Cancel|Go Back|Close)$/ }).last().click();
    await expect(dlg).toHaveCount(0, { timeout: 15_000 });
    await clickSaveAmendment(doctor);

    const vitals = await getVitals(doctorApi, ticket.booking_id);
    const text = dump(vitals);
    expect(text, "BP persisted after Save vital signs").toContain(bp);
    expect(text, "pulse persisted after Save vital signs").toContain(pulse);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /2\. Vital Signs/);
    await expect(doctor.getByRole("textbox", { name: /Enter blood pressure/i })).toHaveValue(bp);
    await expect(doctor.getByRole("textbox", { name: /Enter pulse rate/i })).toHaveValue(pulse);
  });

  test("vital signs persist via edit then Save amendment only", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const bp = "128/82";
    const pulse = "88";
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /2\. Vital Signs/);
    await doctor.getByRole("textbox", { name: /Enter blood pressure/i }).fill(bp);
    await doctor.getByRole("textbox", { name: /Enter pulse rate/i }).fill(pulse);
    await clickSaveAmendment(doctor);

    const vitals = await getVitals(doctorApi, ticket.booking_id);
    const text = dump(vitals);
    expect(text, "BP persisted via Save amendment").toContain(bp);
    expect(text, "pulse persisted via Save amendment").toContain(pulse);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /2\. Vital Signs/);
    await expect(doctor.getByRole("textbox", { name: /Enter blood pressure/i })).toHaveValue(bp);
    await expect(doctor.getByRole("textbox", { name: /Enter pulse rate/i })).toHaveValue(pulse);
  });

  test("diagnosis: a second diagnosis persists via Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const dx2 = `E2E second dx ${tag("dx")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /3\. Diagnosis/);
    await doctor.getByRole("textbox", { name: /Diagnosis \(search ICD-10/ }).fill(dx2);
    await doctor.getByRole("button", { name: "Add", exact: true }).click();
    await expect(doctor.getByText(new RegExp(dx2)).first()).toBeVisible();
    await clickSaveAmendment(doctor);

    const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
    const rows: unknown[] = consult.consultation_diagnoses ?? consult.diagnoses ?? [];
    expect(rows.length, "both diagnoses persisted").toBeGreaterThanOrEqual(2);
    expect(dump(rows), "second diagnosis persisted").toContain(dx2);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /3\. Diagnosis/);
    await expect(doctor.getByText(new RegExp(dx2)).first()).toBeVisible();
  });

  test("prescription: add via Templates tab then ONLY Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup);
    await gotoAmendMode(doctor, ticket.booking_id);
    await addRxFromTemplatesTab(doctor);
    const listed = await doctor.getByRole("heading", { name: /Prescription items/ }).locator("xpath=ancestor::*[.//p][1]").innerText();
    expect(listed, "template added at least one medicine in the form").toMatch(/Prescription items \([2-9]/);
    await clickSaveAmendment(doctor);

    const rx = await getRxGroups(doctorApi, patient.patient_id);
    expect(rx.length, "prescription group persisted").toBeGreaterThan(0);
    expect(dump(rx), "template medicines persisted").toMatch(/generic_name/i);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /4\. Prescription/);
    await expect(doctor.getByRole("heading", { name: /Prescription items \([2-9]/ })).toBeVisible();
  });

  test("prescription: add via New Rx tab then ONLY Ctrl+S", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup);
    const med = `E2E-Rx-CtrlS-${tag("rx")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await addNewRxLine(doctor, med, "10", 2);
    await saveAmendViaCtrlS(doctor);

    const rx = await getRxGroups(doctorApi, patient.patient_id);
    expect(rx.length, "prescription group persisted after Ctrl+S").toBeGreaterThan(0);
    expect(dump(rx), "Ctrl+S persisted the New Rx medicine").toContain(med);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /4\. Prescription/);
    await expect(doctor.getByText(med).first()).toBeVisible();
    await expect(doctor.getByRole("heading", { name: /Prescription items \(2\)/ })).toBeVisible();
  });

  test("prescription: remove a medicine then ONLY Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup);
    const med = `E2E-Rx-Remove-${tag("rm")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await addNewRxLine(doctor, med, "10", 2);
    await saveMedications(doctor);
    await expect
      .poll(async () => dump(await getRxGroups(doctorApi, patient.patient_id)), { timeout: 15_000 })
      .toContain(med);

    await removeAllRxItems(doctor);
    await clickSaveAmendment(doctor);

    const rx = await getRxGroups(doctorApi, patient.patient_id);
    expect(dump(rx), "removed medicine must not remain after Save amendment").not.toContain(med);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /4\. Prescription/);
    await expect(doctor.getByText(med)).toHaveCount(0);
    await expect(doctor.getByRole("heading", { name: /Prescription items \(0\)/ })).toBeVisible();
  });

  //JJQR - AI (Nov 20, 2026) - live Rx: no-meds checkbox + Print Prescription follow unsaved line items; empty Rx in amend still leaves Save enabled
  test("prescription: no-Rx seed, live add unchecks no-meds and shows Print Prescription before save", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup, { rx: false });
    const med = `E2E-Rx-LivePrint-${tag("rx0")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /4\. Prescription/);
    await expect(doctor.getByRole("checkbox", { name: /No medicines this visit/ })).toBeChecked();
    await addNewRxLine(doctor, med, "10", 1);
    await expect(doctor.getByRole("checkbox", { name: /No medicines this visit/ })).not.toBeChecked();
    await expect(doctor.getByRole("checkbox", { name: /No medicines this visit/ })).toBeDisabled();
    await expect(doctor.getByRole("button", { name: /Print Prescription/ })).toBeVisible();
    await clickSaveAmendment(doctor);

    const rx = await getRxGroups(doctorApi, patient.patient_id);
    expect(rx.length, "prescription group persisted").toBeGreaterThan(0);
    expect(dump(rx), "live-added medicine persisted").toContain(med);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /4\. Prescription/);
    await expect(doctor.getByText(med).first()).toBeVisible();
    await expect(doctor.getByRole("button", { name: /Print Prescription/ })).toBeVisible();
  });

  test("prescription: seeded Rx, remove all hides Print Prescription; Save amendment stays enabled", async ({ as, api, tag, cleanup }) => {
    const { doctor, ticket } = await seedAndComplete(as, api, tag, cleanup);
    await gotoAmendMode(doctor, ticket.booking_id);
    await removeAllRxItems(doctor);
    await expect(doctor.getByRole("button", { name: /Print Prescription/ })).toHaveCount(0);
    await expect(doctor.getByRole("button", { name: "Save amendment" })).toBeEnabled();
    await clickSaveAmendment(doctor);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await expect(doctor.getByRole("button", { name: "Save amendment" })).toBeEnabled();
    await openSectionByTitle(doctor, /4\. Prescription/);
    await expect(doctor.getByRole("checkbox", { name: /No medicines this visit/ })).toBeChecked();
  });
  //JJQR - END

  test("lab orders: add a test then Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const testName = `E2E Throat swab ${tag("lab")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /5\. Lab Orders/);
    await doctor.getByRole("textbox", { name: "Add another test" }).fill(testName);
    await doctor.getByRole("textbox", { name: "Reason / clinical indication" }).fill("amend persist");
    await doctor.getByRole("button", { name: "Add test" }).click();
    await expect(doctor.getByText(testName, { exact: false })).toBeVisible();
    await clickSaveAmendment(doctor);

    const labs = await getLabOrders(doctorApi, ticket.booking_id);
    expect(dump(labs), "lab order persisted").toContain(testName);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /5\. Lab Orders/);
    await expect(doctor.getByText(testName, { exact: false })).toBeVisible();
  });

  test("vaccinations: stage a dose then Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup);
    const vax = `E2E Influenza ${tag("vax")}`;
    const lot = `LOT-${tag("lot")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await showOccasionalSections(doctor);
    await openSectionByTitle(doctor, /Vaccinations/);
    await doctor.getByRole("textbox", { name: "Vaccine Name" }).fill(vax);
    await doctor.getByRole("textbox", { name: "Dose #" }).fill("1");
    await doctor.getByRole("textbox", { name: "Lot #" }).fill(lot);
    await doctor.getByRole("button", { name: "Stage Vaccination" }).click();
    await expect(doctor.getByText(new RegExp(vax)).first()).toBeVisible();
    await clickSaveAmendment(doctor);

    const rows = await getVaccinations(doctorApi, patient.patient_id);
    const text = dump(rows);
    expect(text, "vaccination name persisted").toContain(vax);
    expect(text, "vaccination lot persisted").toContain(lot);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await showOccasionalSections(doctor);
    await openSectionByTitle(doctor, /Vaccinations/);
    await expect(doctor.getByText(new RegExp(vax)).first()).toBeVisible();
  });

  test("medical certificate: edit a field then Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup);
    const consultRow = await getConsultationByBooking(doctorApi, ticket.booking_id);
    const certSeed = await doctorApi.put(`/api/medical-certificates/by-consultation/${consultRow.consultation_id}`, {
      data: {
        patient_id: patient.patient_id,
        doctor_id: consultRow.doctor_id,
        issue_date: manilaDate(),
        patient_address_snapshot: "E2E seed address",
        diagnosis_text: "E2E seed dx",
      },
    });
    if (!certSeed.ok()) throw new Error(`seed med-cert → ${certSeed.status()} ${await certSeed.text()}`);
    const address = `E2E 9 Amend St ${tag("mc")}`;
    const diagnosis = `E2E amend cert dx ${tag("mcdx")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /Medical Certificate/);
    await doctor.getByRole("textbox", { name: /Patient address/ }).fill(address);
    await doctor.getByPlaceholder(/Diagnosis \/ Impressions/).fill(diagnosis);
    await clickSaveAmendment(doctor);

    const cert = await getMedicalCertificate(doctorApi, ticket.booking_id);
    expect(cert, "medical certificate persisted").toBeTruthy();
    expect(dump(cert), "med-cert address persisted").toContain(address);
    expect(dump(cert), "med-cert diagnosis persisted").toContain(diagnosis);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /Medical Certificate/);
    await expect(doctor.getByRole("textbox", { name: /Patient address/ })).toHaveValue(address);
    await expect(doctor.getByPlaceholder(/Diagnosis \/ Impressions/)).toHaveValue(diagnosis);
  });

  test("professional fee: Charge PF amount persists via Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const amount = "777";
    await gotoAmendMode(doctor, ticket.booking_id);
    await showOccasionalSections(doctor);
    await openSectionByTitle(doctor, /Professional Fee/);
    await doctor.getByRole("button", { name: "Charge", exact: true }).click();
    await doctor.getByRole("textbox", { name: "Amount" }).fill(amount);
    await clickSaveAmendment(doctor);

    const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
    expect(consult.pf_decision, "PF decision persisted").toBe("Charge");
    expect(Number(consult.pf_amount), "PF amount persisted").toBe(777);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await showOccasionalSections(doctor);
    await openSectionByTitle(doctor, /Professional Fee/);
    await expect(doctor.getByRole("textbox", { name: "Amount" })).toHaveValue(amount);
  });

  test("follow-up: set a date then Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    await gotoAmendMode(doctor, ticket.booking_id);
    const dateLabel = await pickFollowUpDate(doctor);
    await doctor.getByRole("textbox", { name: "Reason", exact: true }).fill(`E2E amend FU ${tag("fu")}`);
    await clickSaveAmendment(doctor);

    const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
    const fu = consult.follow_ups ?? consult.follow_up ?? consult.followUp;
    const followUp = Array.isArray(fu) ? fu[0] : fu;
    expect(followUp, "follow-up persisted").toBeTruthy();
    expect(followUp.follow_up_date, "follow-up date persisted").toBeTruthy();
    const iso = String(followUp.follow_up_date);
    expect(iso, "follow-up date is the 15th").toMatch(/-15(?:T|$)/);
    expect(dump(followUp), "follow-up reason persisted").toContain(`E2E amend FU`);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await openSectionByTitle(doctor, /6\. Follow-up/);
    await expect(doctor.getByRole("button", { name: "Select date" })).toHaveCount(0);
    const dayNum = dateLabel.match(/\b15\b/)?.[0] ?? "15";
    await expect(doctor.getByRole("button", { name: new RegExp(`${dayNum}, \\d{4}`) })).toBeVisible();
  });

  test("allergies: add an allergy then Save amendment", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket, patient } = await seedAndComplete(as, api, tag, cleanup);
    const allergen = `E2E Penicillin ${tag("alg")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await addAllergyViaBanner(doctor, allergen);
    await clickSaveAmendment(doctor);

    const rows = await getPatientAllergies(doctorApi, patient.patient_id);
    expect(dump(rows), "allergy persisted").toContain(allergen);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await expect(doctor.getByText(new RegExp(allergen)).first()).toBeVisible();
  });

  test("Ctrl+S persists a SOAP edit", async ({ as, api, tag, cleanup }) => {
    const { doctor, doctorApi, ticket } = await seedAndComplete(as, api, tag, cleanup);
    const assessment = `E2E CtrlS assessment ${tag("cs")}`;
    await gotoAmendMode(doctor, ticket.booking_id);
    await expandSoapSection(doctor);
    await doctor.getByRole("textbox", { name: "Assessment", exact: true }).fill(assessment);
    await saveAmendViaCtrlS(doctor);

    const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
    expect(consult.assessment, "Ctrl+S persisted assessment").toBe(assessment);

    await doctor.reload();
    await gotoAmendMode(doctor, ticket.booking_id);
    await expandSoapSection(doctor);
    await expect(doctor.getByRole("textbox", { name: "Assessment", exact: true })).toHaveValue(assessment);
  });
});
//JJQR - END
