import { test, expect } from "../support/fixtures";
import {
  createTaggedPatient,
  getDoctor,
  checkInWalkIn,
  getBooking,
  getConsultationByBooking,
  getRxGroups,
  getVitals,
  getLabOrders,
  getMedicalCertificate,
  getVaccinations,
} from "../support/api";
import { confirmReviewSectionSave as confirmDialog } from "../support/consultation-flow";
import { settleViaApi } from "../support/visit";
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

test("walk-in visit: register → full consultation (+ med cert) → pay → prescription PDF", async ({ as, api, tag: tagFx, cleanup }) => {
  test.setTimeout(240_000);
  const tag = Date.now().toString(36);

  const staffApi = await api("staff");
  const doctorApi = await api("doctor");

  //JJQR - AI (Nov 20, 2026) - batch 2: the dev doctor has no PRC / PTR / S2 numbers, and the print only shows them when set — give the doctor
  // test numbers for this journey and put the originals back afterwards (same PUT the admin edit page uses).
  const adminApi = await api("admin");
  const docBefore = await getDoctor(adminApi);
  cleanup(async () => void (await adminApi.put(`/api/doctors/${docBefore.doctor_id}`, { data: docBefore })));
  const lic = await adminApi.put(`/api/doctors/${docBefore.doctor_id}`, { data: { ...docBefore, license_number: "LIC-E2E-FV", ptr_number: "PTR-E2E-FV", s2_number: "S2-E2E-FV" } });
  expect(lic.ok(), `set doctor numbers → ${lic.status()}`).toBeTruthy();
  //JJQR - END

  // ── setup: a fresh patient in today's queue ──────────────────────────────
  const patient = await createTaggedPatient(staffApi, tagFx("fv"));
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
  cleanup(async () => {
    await staffApi.put(`/api/queue/${ticket.booking_id}/complete`).catch(() => undefined);
    await settleViaApi(staffApi, ticket.booking_id);
  });
  const patientName = `${patient.first_name} ${patient.last_name}`;
  expect(ticket.provisional_fee).toBe(450); // standard New consultation

  // ── staff: call the patient in from the queue board ──────────────────────
  const staff = await as("staff");
  await staff.goto("/staff/queue");
  const queueRow = staff.locator("tr", { hasText: ticket.queue_number });
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole("button", { name: "Call" }).click();
  await expect(queueRow.getByText(/IN\s*PROGRESS|InProgress|INPROGRESS/i)).toBeVisible({ timeout: 15_000 });

  // ── doctor: run the consultation ────────────────────────────────────────
  // "Start Consultation" (/doctor/appointments) and "Open Consult" (queue board)
  // both just link here — go direct so the journey doesn't hinge on list state.
  //JJQR - AI (Nov 20, 2026) - batch 2: rewritten for the redesigned consultation screen (step bar, labelled boxes, "Review & complete")
  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await expect(doctor.getByRole("heading", { name: "Document consultation", level: 1 })).toBeVisible();
  const steps = doctor.getByRole("navigation", { name: "Consultation sections" });
  const open = (re: RegExp) => steps.getByRole("button", { name: re }).first().click();

  // ── 1. Clinical notes — all five free-text fields ──────────────────────
  await doctor.getByRole("textbox", { name: /Chief complaint/ }).fill(SOAP.chiefComplaint);
  await doctor.getByRole("textbox", { name: "Subjective", exact: true }).fill(SOAP.subjective);
  await doctor.getByRole("textbox", { name: "Objective", exact: true }).fill(SOAP.objective);
  await doctor.getByRole("textbox", { name: "Assessment", exact: true }).fill(SOAP.assessment);
  await doctor.getByRole("textbox", { name: "Plan", exact: true }).fill(SOAP.plan);

  // ── 2. Vital Signs — every default field, then Save vital signs → confirm ─
  await open(/2\. Vital Signs/);
  for (const [field, value] of Object.entries(VITALS)) {
    const input = doctor.getByRole("textbox", { name: `Enter ${field}` });
    await expect(input).toBeVisible();
    await input.fill(value);
  }
  await doctor.getByRole("button", { name: "Save vital signs" }).click();
  await confirmDialog(doctor);

  // ── 3. Diagnosis — a primary + a secondary line ────────────────────────
  await open(/3\. Diagnosis/);
  const dx = doctor.getByRole("textbox", { name: /Diagnosis \(search ICD-10/ });
  await expect(dx).toBeVisible();
  await dx.fill(DX_PRIMARY);
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText(`${DX_PRIMARY} (Primary)`)).toBeVisible();
  await dx.fill(DX_SECONDARY);
  await doctor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(doctor.getByText(`${DX_SECONDARY} (Secondary)`)).toBeVisible();

  // ── 4. Prescription — one item, then Save medications → confirm ────────
  await open(/4\. Prescription/);
  // soft allergy gate blocks Add Item until the allergies are reviewed
  const ackBtn = doctor.getByRole("button", { name: "Acknowledge" });
  if (await ackBtn.isVisible()) await ackBtn.click();
  await doctor.getByRole("textbox", { name: "Medication" }).fill("Paracetamol");
  await doctor.getByRole("textbox", { name: "Dosage / strength" }).fill("500 mg");
  await doctor.getByRole("textbox", { name: "Quantity" }).fill("20 tablets");
  await doctor.getByRole("button", { name: "Breakfast", exact: true }).click();
  await doctor.getByRole("button", { name: "Days", exact: true }).click();
  await doctor.getByPlaceholder("# days").fill("5");
  await doctor.getByRole("button", { name: "Add Item" }).click();
  await expect(doctor.getByRole("heading", { name: "Prescription items (1)" })).toBeVisible();
  await doctor.getByRole("button", { name: "Save medications" }).click();
  await doctor.getByRole("dialog", { name: /Confirm Prescription/ }).getByRole("button", { name: /Confirm & Save/ }).click();
  await expect(doctor.getByRole("dialog", { name: /Confirm Prescription/ })).toHaveCount(0, { timeout: 15_000 });

  // ── 5. Lab Orders — one handwritten test (persists on Complete) ─────────
  await open(/5\. Lab Orders/);
  await doctor.getByRole("textbox", { name: "Add another test" }).fill(LAB_TEST);
  await doctor.getByRole("textbox", { name: "Reason / clinical indication" }).fill("rule out strep");
  await doctor.getByRole("button", { name: "Add test" }).click();
  await expect(doctor.getByText(LAB_TEST, { exact: false })).toBeVisible();

  // ── 6. Vaccinations (behind More) — stage one dose ─────────────────────
  { const more = steps.getByRole('button', { name: 'More', exact: true }); if (await more.count() > 0) await more.click(); } //JJQR - AI (Nov 20, 2026)
  await open(/Vaccinations/);
  await doctor.getByRole("textbox", { name: "Vaccine Name" }).fill(VAX.name);
  await doctor.getByRole("textbox", { name: "Dose #" }).fill(VAX.dose);
  await doctor.getByRole("textbox", { name: "Route" }).fill(VAX.route);
  await doctor.getByRole("textbox", { name: "Site" }).fill(VAX.site);
  await doctor.getByRole("textbox", { name: "Lot #" }).fill(VAX.lot);
  await doctor.getByRole("textbox", { name: "Manufacturer" }).fill(VAX.maker);
  await doctor.getByRole("button", { name: "Stage Vaccination" }).click();
  await expect(doctor.getByText(`${VAX.name} — Dose #${VAX.dose}`, { exact: false })).toBeVisible();

  // ── 7. Follow-up — date + reason + instructions (persists on Complete) ──
  await open(/Follow-up/);
  await doctor.getByRole("button", { name: "Select date" }).click();
  await doctor.getByRole("button", { name: "Next month" }).click();
  await doctor.getByRole("dialog", { name: "Choose a date" }).getByRole("button", { name: /^[A-Za-z]+ 15, \d{4}$/ }).click(); // day cells are labelled "December 15, 2026"
  // the trigger now shows the chosen date instead of the "Select date" placeholder
  await expect(doctor.getByRole("button", { name: "Select date" })).toHaveCount(0);
  await doctor.getByRole("textbox", { name: "Reason", exact: true }).fill(FOLLOWUP_REASON);
  await doctor.getByRole("textbox", { name: "Instructions", exact: true }).fill(FOLLOWUP_INSTRUCTIONS);

  // ── 8. Medical Certificate — fill + save (own endpoint, persists now) ──
  await open(/Medical Certificate/);
  await doctor.getByRole("textbox", { name: /Patient address/ }).fill(MC_ADDRESS);
  await doctor.getByRole("textbox", { name: /Diagnosis \/ Impressions/ }).fill(MC_DIAGNOSIS);
  await doctor.getByRole("textbox", { name: /Recommendations/ }).fill(MC_RECOMMENDATIONS);
  await doctor.getByRole("button", { name: "Save without printing" }).click();
  await doctor.getByRole("dialog", { name: /Confirm Medical Certificate/ }).getByRole("button", { name: /Confirm & Save/ }).click();
  await expect(doctor.getByRole("dialog", { name: /Confirm Medical Certificate/ })).toHaveCount(0, { timeout: 15_000 });

  // ── 9. Professional Fee Decision — flag med-cert fee + record a charge ──
  await open(/Professional Fee Decision/);
  // the +₱50 med-cert line item — this checkbox DOES persist (backend recomputes the fee)
  //JJQR - AI (Nov 20, 2026)
  const medCertBox = doctor.getByRole("checkbox", { name: /Medical certificate/ });
  if (!(await medCertBox.isChecked())) await medCertBox.click();
  await expect(medCertBox).toBeChecked();
  await doctor.getByRole("button", { name: "Charge PF" }).click();
  await doctor.getByRole("textbox", { name: "Amount" }).fill("500");

  // ── Complete → checklist modal → confirm ──────────────────────────────
  // The "Consultation saved" screen only renders after handleComplete has
  // finished ALL its writes (row + PF → diagnoses → follow-up → lab orders →
  // vaccinations), so this is where every child record is guaranteed on the server.
  await expect(doctor.getByRole("button", { name: "Complete Consultation" })).toBeEnabled({ timeout: 10_000 });
  await doctor.getByRole("button", { name: "Complete Consultation" }).click();
  await doctor.getByRole("button", { name: "Confirm & Complete" }).click();
  await expect(doctor.getByText("Consultation saved")).toBeVisible({ timeout: 20_000 });
  //JJQR - END

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

  // ── staff: the queue entry is already Completed — the doctor's Complete
  // Consultation click flips the booking's own status via the queue
  // "/complete" endpoint, same as this manual button used to. Regression
  // test for a real bug: that call was missing, so a completed consultation
  // never showed up as "Ready for Payment" until staff manually clicked
  // Complete here — this asserts it's automatic now, not a leftover manual step.
  await staff.goto("/staff/queue");
  const row2 = staff.locator("tr", { hasText: ticket.queue_number });
  await expect(row2.getByText("COMPLETED")).toBeVisible();

  await staff.goto("/staff/payments");
  //JJQR - AI (Nov 20, 2026) - batch 2: the payments list is a table with "Record payment" and a labelled dialog
  const payRow = staff.getByRole("row", { name: new RegExp(patient.first_name, "i") });
  await expect(payRow).toBeVisible({ timeout: 15_000 });
  await expect(payRow).toContainText(`₱${expectedDue}`);
  await payRow.getByRole("button", { name: "Record payment" }).click();
  const payDialog = staff.getByRole("dialog", { name: /Record payment of/ });
  await expect(payDialog.getByLabel("Amount received (₱)")).toHaveValue(String(expectedDue));
  await payDialog.getByLabel("Method").selectOption("Cash");
  await payDialog.getByRole("button", { name: "Record payment" }).click();
  await expect(payRow).toHaveCount(0, { timeout: 15_000 });
  //JJQR - END

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
  await printWin.locator(".form").waitFor({ timeout: 10_000 });
  await printWin.getByText("DURATION").waitFor({ timeout: 10_000 });

  const html = await printWin.content();
  expect(html).toContain("DURATION");
  expect(html).toContain(patientName);
  expect(html).toContain("Paracetamol");
  expect(html).toContain("20 tablets");
  expect(html).toMatch(/Sig\.?/i);
  // F-009: patient-tab print path must surface license / PTR / S2 from print-forms
  expect(html).toMatch(/License No:/);
  expect(html).toMatch(/PTR No:/);
  expect(html).toMatch(/S2 No:/);

  mkdirSync(ARTIFACTS, { recursive: true });
  const pdfPath = join(ARTIFACTS, `prescription-${tag}.pdf`);
  await printWin.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await test.info().attach("prescription.pdf", { path: pdfPath, contentType: "application/pdf" });
});
