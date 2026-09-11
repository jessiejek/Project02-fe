import { test, expect } from "../support/fixtures";
import {
  createPatient,
  checkInWalkIn,
  getBooking,
  getConsultationByBooking,
  getRxGroups,
  getVitals,
  getLabOrders,
  getMedicalCertificate,
  getVaccinations,
} from "../support/api";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ARTIFACTS = join(__dirname, "..", "artifacts");

/**
 * The flagship journey — one real walk-in visit, end to end, across three roles:
 *
 *   staff   registers a new patient  →  checks them into today's queue  →  calls them in
 *   doctor  fills EVERY clinical field in the consultation  →  completes it
 *   staff   marks the queue entry complete  →  collects the payment (Cash)
 *   doctor  prints the prescription  →  we capture the print window and check the PDF
 *
 * The point of filling every field is to prove each one is actually DB-backed:
 * after "Complete Consultation" we read the row (and its children) straight from
 * the .NET API and assert the exact values we typed came back. A field that
 * renders but never persists will fail here.
 *
 * API calls are used only for setup and for asserting server state; every
 * clinical action goes through the UI.
 */

// The exact strings we type — reused for both entry and the server-side asserts.
const SOAP = {
  chiefComplaint: "E2E sore throat and low-grade fever, 2 days",
  subjective: "E2E patient reports odynophagia, mild myalgia, no cough, no dyspnea.",
  objective: "E2E oropharynx erythematous, no exudate, tonsils not enlarged, chest clear.",
  assessment: "E2E acute viral pharyngitis, uncomplicated.",
  plan: "E2E supportive care, hydration, paracetamol PRN, return if worsening.",
};
const DX_PRIMARY = "Acute viral pharyngitis";
const DX_SECONDARY = "Mild dehydration";
const LAB_TEST = "E2E Throat swab culture";
const FOLLOWUP_REASON = "E2E re-check if symptoms persist beyond 5 days";
const FOLLOWUP_INSTRUCTIONS = "E2E return sooner for high fever, difficulty swallowing, or rash.";
const VAX = { name: "E2E Influenza vaccine", dose: "1", route: "IM", site: "Left deltoid", lot: "E2E-LOT-77", maker: "E2E Biologics" };
const MC_DIAGNOSIS = "E2E acute viral pharyngitis — unfit for work";
const MC_RECOMMENDATIONS = "E2E rest for 2 days, oral hydration, follow up if not improving";
const MC_ADDRESS = "E2E 12 Mabini St, Lapu-Lapu City";
const VITALS = {
  "blood pressure": "120/80",
  "pulse rate": "74",
  temperature: "37.4",
  "respiratory rate": "18",
  "o2 saturation": "98",
  weight: "68",
  height: "170",
};

test("walk-in visit: register → full consultation (+ med cert) → pay → prescription PDF", async ({ as, api }) => {
  test.setTimeout(240_000);
  const tag = Date.now().toString(36);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  // ── setup: a fresh patient in today's queue ──────────────────────────────
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
  const patientName = `${patient.first_name} ${patient.last_name}`;
  expect(ticket.provisional_fee).toBe(450); // standard New consultation

  // ── staff: call the patient in from the queue board ──────────────────────
  const staff = await as("staff");
  await staff.goto("/staff/queue");
  const queueRow = staff.locator("tr", { hasText: ticket.queue_number });
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole("button", { name: "Call" }).click();
  await expect(queueRow.getByText("INPROGRESS")).toBeVisible();

  // ── doctor: run the consultation ────────────────────────────────────────
  // "Start Consultation" (/doctor/appointments) and "Open Consult" (queue board)
  // both just link here — go direct so the journey doesn't hinge on list state.
  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation/${ticket.booking_id}`);
  await expect(doctor.getByRole("heading", { name: /SOAP & Chief Complaint/ })).toBeVisible();

  // Progress is a header dropdown now (closed by default), not a floating
  // panel — nothing to dismiss before filling the form.

  // ── 1. SOAP — all five free-text fields ────────────────────────────────
  await doctor.getByPlaceholder("Chief Complaint*").fill(SOAP.chiefComplaint);
  await doctor.getByPlaceholder("Subjective", { exact: true }).fill(SOAP.subjective);
  await doctor.getByPlaceholder("Objective", { exact: true }).fill(SOAP.objective);
  await doctor.getByPlaceholder("Assessment", { exact: true }).fill(SOAP.assessment);
  await doctor.getByPlaceholder("Plan", { exact: true }).fill(SOAP.plan);

  // ── 2. Vital Signs — every default field, then Save → confirm ───────────
  await doctor.getByRole("heading", { name: /2\. Vital Signs/ }).click();
  for (const [field, value] of Object.entries(VITALS)) {
    const input = doctor.getByPlaceholder(`Enter ${field}`);
    await expect(input).toBeVisible();
    await input.fill(value);
  }
  await doctor.getByRole("button", { name: "Save", exact: true }).click();
  await doctor.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(doctor.getByText(/Vitals saved at/)).toBeVisible();

  // ── 3. Diagnosis — a primary + a secondary line ────────────────────────
  await doctor.getByRole("heading", { name: /3\. Diagnosis/ }).click();
  const dx = doctor.getByPlaceholder("Diagnosis (free text)*");
  await expect(dx).toBeVisible();
  await dx.fill(DX_PRIMARY);
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText(`${DX_PRIMARY} (Primary)`)).toBeVisible();
  await dx.fill(DX_SECONDARY);
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText(`${DX_SECONDARY} (Secondary)`)).toBeVisible();

  // ── 4. Prescription — one item, then Save (Add Item only stages it) ─────
  await doctor.getByRole("heading", { name: /4\. Prescription/ }).click();
  const med = doctor.getByPlaceholder("Medication — pick from the list or just type it");
  await expect(med).toBeVisible();
  await med.fill("Paracetamol");
  await doctor.getByPlaceholder("Dosage / strength").fill("500 mg");
  await doctor.getByPlaceholder("# Quantity (e.g. 30, 1 box)").fill("20 tablets");
  await doctor.getByRole("button", { name: "Add Item" }).click();
  await expect(doctor.getByText("Paracetamol", { exact: false })).toBeVisible();
  await doctor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(doctor.getByText(/Prescription saved at/)).toBeVisible();

  // ── 5. Lab Orders — one handwritten test (persists on Complete) ─────────
  await doctor.getByRole("heading", { name: /5\. Lab Orders/ }).click();
  await doctor.getByPlaceholder("Add another test").fill(LAB_TEST);
  await doctor.getByPlaceholder("Reason / clinical indication").fill("rule out strep");
  await doctor.getByRole("button", { name: "Add test" }).click();
  await expect(doctor.getByText(LAB_TEST, { exact: false })).toBeVisible();

  // ── 6. Vaccinations — stage one dose ───────────────────────────────────
  await doctor.getByRole("heading", { name: /6\. Vaccinations/ }).click();
  await doctor.getByPlaceholder("Vaccine Name").fill(VAX.name);
  await doctor.getByPlaceholder("Dose #").fill(VAX.dose);
  await doctor.getByPlaceholder("Route").fill(VAX.route);
  await doctor.getByPlaceholder("Site").fill(VAX.site);
  await doctor.getByPlaceholder("Lot #").fill(VAX.lot);
  await doctor.getByPlaceholder("Manufacturer").fill(VAX.maker);
  await doctor.getByRole("button", { name: "Stage Vaccination" }).click();
  await expect(doctor.getByText(`${VAX.name} — Dose #${VAX.dose}`, { exact: false })).toBeVisible();

  // ── 7. Follow-up — date + reason + instructions (persists on Complete) ──
  await doctor.getByRole("heading", { name: /7\. Follow-up/ }).click();
  await doctor.getByRole("button", { name: "Select date" }).click();
  await doctor.getByRole("button", { name: "Next month" }).click();
  await doctor.getByRole("button", { name: "15", exact: true }).first().click();
  // the trigger now shows the chosen date instead of the "Select date" placeholder
  await expect(doctor.getByRole("button", { name: "Select date" })).toHaveCount(0);
  await doctor.getByPlaceholder("Reason").fill(FOLLOWUP_REASON);
  await doctor.getByPlaceholder("Instructions").fill(FOLLOWUP_INSTRUCTIONS);

  // ── 8. Medical Certificate — fill + save (own endpoint, persists now) ──
  await doctor.getByRole("heading", { name: /8\. Medical Certificate/ }).click();
  await doctor.getByPlaceholder(/residing at/).fill(MC_ADDRESS);
  await doctor.getByPlaceholder(/Diagnosis \/ Impressions/).fill(MC_DIAGNOSIS);
  await doctor.getByPlaceholder(/Recommendations/).fill(MC_RECOMMENDATIONS);
  await doctor.getByRole("button", { name: "Save without printing" }).click();
  await expect(doctor.getByText(/Certificate saved at/)).toBeVisible({ timeout: 15_000 });

  // ── 9. Professional Fee Decision — flag med-cert fee + record a charge ──
  await doctor.getByRole("heading", { name: /9\. Professional Fee Decision/ }).click();
  // the +₱50 med-cert line item — this checkbox DOES persist (backend recomputes the fee)
  await doctor.getByRole("checkbox", { name: /Medical certificate/ }).check();
  await doctor.getByRole("button", { name: "Charge PF" }).click();
  await doctor.getByPlaceholder("Amount*").fill("500");

  // ── Complete → checklist modal → confirm ──────────────────────────────
  await doctor.getByRole("button", { name: "Complete Consultation" }).click();
  await doctor.getByRole("button", { name: "Confirm & Complete" }).click();
  // The "Consultation saved" screen only renders after handleComplete has
  // finished ALL its writes (row + PF → diagnoses → follow-up → lab orders →
  // vaccinations), so this is where every child record is guaranteed on the server.
  await expect(doctor.getByText("Consultation saved")).toBeVisible({ timeout: 20_000 });

  // ── server-side: every field we typed actually persisted ──────────────
  await expect
    .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status, {
      timeout: 20_000,
    })
    .toBe("Completed");

  const consult = await getConsultationByBooking(doctorApi, ticket.booking_id);
  expect(consult, "consultation row").toBeTruthy();
  expect(consult.chief_complaint, "chief_complaint persisted").toBe(SOAP.chiefComplaint);
  expect(consult.subjective, "subjective persisted").toBe(SOAP.subjective);
  expect(consult.objective, "objective persisted").toBe(SOAP.objective);
  expect(consult.assessment, "assessment persisted").toBe(SOAP.assessment);
  expect(consult.plan, "plan persisted").toBe(SOAP.plan);

  const dxRows: Array<{ custom_description?: string; type?: string }> =
    consult.consultation_diagnoses ?? consult.diagnoses ?? [];
  const dxText = JSON.stringify(dxRows);
  expect(dxRows.length, "both diagnoses persisted").toBeGreaterThanOrEqual(2);
  expect(dxText, "primary diagnosis persisted").toContain(DX_PRIMARY);
  expect(dxText, "secondary diagnosis persisted").toContain(DX_SECONDARY);

  // by-booking embeds the follow-up under `follow_ups` — sometimes the object, sometimes a 1-element array.
  const fu = consult.follow_ups ?? consult.follow_up ?? consult.followUp;
  const followUp = Array.isArray(fu) ? fu[0] : fu;
  expect(followUp, "follow-up persisted").toBeTruthy();
  expect(followUp.reason, "follow-up reason persisted").toBe(FOLLOWUP_REASON);
  expect(followUp.instructions, "follow-up instructions persisted").toBe(FOLLOWUP_INSTRUCTIONS);
  expect(followUp.follow_up_date, "follow-up date persisted").toBeTruthy();

  const vitals = await getVitals(doctorApi, ticket.booking_id);
  expect(vitals.length, "all vitals persisted").toBeGreaterThanOrEqual(Object.keys(VITALS).length);
  expect(JSON.stringify(vitals), "BP reading persisted").toContain("120/80");

  const labs = await getLabOrders(doctorApi, ticket.booking_id);
  expect(JSON.stringify(labs), "lab order persisted").toContain(LAB_TEST);

  const rx = await getRxGroups(doctorApi, patient.patient_id);
  expect(rx.length, "prescription group persisted").toBeGreaterThan(0);
  expect(JSON.stringify(rx), "prescription item persisted").toContain("Paracetamol");

  // Medical Certificate — its own endpoint; the "Save without printing" click persisted it.
  const cert = await getMedicalCertificate(doctorApi, ticket.booking_id);
  expect(cert, "medical certificate persisted").toBeTruthy();
  expect(JSON.stringify(cert), "med-cert diagnosis persisted").toContain(MC_DIAGNOSIS);
  expect(JSON.stringify(cert), "med-cert recommendations persisted").toContain(MC_RECOMMENDATIONS);

  // Professional Fee section: the med-cert checkbox feeds the fee engine — ticking
  // it (+₱50) must have bumped the booking total from ₱450 to ₱500 on Complete.
  const bookingAfter = await getBooking(doctorApi, ticket.booking_id);
  expect(Number(bookingAfter.total_fee), "med-cert +₱50 applied to booking").toBe(500);
  const expectedDue = Number(bookingAfter.total_fee);

  // PF decision — persisted on the consultation row.
  expect(consult.pf_decision, "PF decision persisted").toBe("Charge");
  expect(Number(consult.pf_amount), "PF amount persisted").toBe(500);

  // Vaccinations — the dose staged this visit landed in patient_vaccinations.
  const vax = await getVaccinations(doctorApi, patient.patient_id);
  const vaxText = JSON.stringify(vax);
  expect(vaxText, "vaccination name persisted").toContain(VAX.name);
  expect(vaxText, "vaccination lot persisted").toContain(VAX.lot);
  expect(vaxText, "vaccination route persisted").toContain(VAX.route);

  // ── staff: finish the queue entry + collect payment ─────────────────────
  await staff.goto("/staff/queue");
  const row2 = staff.locator("tr", { hasText: ticket.queue_number });
  await row2.getByRole("button", { name: "Complete" }).click();
  await expect(row2.getByText("COMPLETED")).toBeVisible();

  await staff.goto("/staff/payments");
  const payRow = staff.locator("tr, li", { hasText: ticket.queue_number });
  await payRow.getByRole("button", { name: "Confirm Payment" }).click();
  const payDialog = staff.getByRole("dialog");
  await payDialog.getByRole("combobox").selectOption("Cash");
  await payDialog.getByPlaceholder("Amount Received").fill(String(expectedDue));
  await payDialog.getByRole("button", { name: "Confirm", exact: true }).click();

  await expect
    .poll(async () => (await getBooking(staffApi, ticket.booking_id)).status, { timeout: 20_000 })
    .toBe("Completed");

  // ── doctor: print the prescription, capture the PDF ─────────────────────
  await doctor.goto(`/doctor/patients/${patient.patient_id}?tab=prescriptions`);
  await expect(doctor.getByRole("button", { name: "Print prescription" })).toBeVisible({ timeout: 15_000 });
  const popupPromise = doctor.context().waitForEvent("page");
  await doctor.getByRole("button", { name: "Print prescription" }).click();      // opens Print Preview modal
  await doctor.getByRole("button", { name: "Print", exact: true }).click();      // fires window.print()
  const printWin = await popupPromise;
  // printHtml() does window.open() then document.write()/close() — wait for the
  // written DOM to actually be there before snapshotting it.
  await printWin.getByRole("heading", { name: "Prescription" }).waitFor({ timeout: 10_000 });

  const html = await printWin.content();
  expect(html).toContain("Prescription");
  expect(html).toContain(patientName);
  expect(html).toContain("Paracetamol");
  expect(html).toContain("20 tablets");
  expect(html).toMatch(/Sig\./);

  mkdirSync(ARTIFACTS, { recursive: true });
  const pdfPath = join(ARTIFACTS, `prescription-${tag}.pdf`);
  await printWin.pdf({ path: pdfPath, format: "A4", printBackground: true });
  await test.info().attach("prescription.pdf", { path: pdfPath, contentType: "application/pdf" });
});
