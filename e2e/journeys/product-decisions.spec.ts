import { test, expect } from "../support/fixtures";
import { checkInWalkIn, createPatient, getBooking, getConsultationByBooking } from "../support/api";

//JJQR - AI (Oct 31, 2026)
test.describe("Product decisions regression", () => {
  test("patient profile validates and saves contact", async ({ as }) => {
    const page = await as("patient");
    await page.goto("/patient/profile");
    const phone = page.locator("#field-contact-number");
    await phone.fill("+63 917 000 1234");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Profile saved at/i)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.locator("#field-contact-number")).toHaveValue("+63 917 000 1234");
  });

  test("doctor templates page loads", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates");
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
    await expect(page.getByRole("button", { name: /SOAP \(\d+\)/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("Search this tab…")).toBeVisible();
    await expect(page.getByRole("button", { name: "General", exact: true })).toBeVisible();
  });

  test("doctor topbar search opens results", async ({ as, api }) => {
    const staffApi = await api("staff");
    const tag = "S" + Date.now().toString(36).slice(-6);
    const patient = await createPatient(staffApi, tag);
    const page = await as("doctor");
    await page.goto("/doctor/dashboard");
    const input = page.getByPlaceholder("Search patients, doctors, or appointments...");
    // Unique tag avoids cap-8 collision with older E2E rows
    await input.fill(patient.first_name);
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("listbox").getByRole("option").filter({ hasText: patient.first_name })).not.toHaveCount(0, { timeout: 15_000 });
  });

  test("vaccinations section visible without occasional toggle", async ({ as, api }) => {
    const staffApi = await api("staff");
    const tag = Date.now().toString(36);
    const patient = await createPatient(staffApi, tag);
    const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${ticket.booking_id}?mode=complete`);
    await expect(page.getByRole("heading", { name: /Vaccinations/i })).toBeVisible({ timeout: 15_000 });
    // Lab/MedCert/PF remain under Show occasional — button may still be present
  });

  test("patient cancel pending uses in-app modal", async ({ as, api }) => {
    const patientApi = await api("patient");
    const bookRes = await patientApi.post("/api/bookings/book", {
      data: { visitType: "New", notes: "E2E product-decisions cancel modal" },
    });
    if (!bookRes.ok()) throw new Error(`book → ${bookRes.status()} ${await bookRes.text()}`);
    const booked = (await bookRes.json()) as { booking_id: string; status?: string };
    expect(booked.status ?? "Pending").toMatch(/Pending/i);

    const page = await as("patient");
    await page.goto(`/patient/bookings/${booked.booking_id}`);
    await expect(page.getByRole("button", { name: "Cancel Booking" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Cancel Booking" }).click();
    await expect(page.getByRole("dialog", { name: /Cancel/i })).toBeVisible();
    await page.getByPlaceholder("Reason (optional)").fill("E2E schedule conflict");
    await page.getByRole("button", { name: "Confirm Cancel" }).click();
    await expect(page.getByText("Cancelled")).toBeVisible({ timeout: 15_000 });
  });

  test("allergies editable on completed consult view", async ({ as, api }) => {
    test.setTimeout(90_000);

    const staffApi = await api("staff");
    const doctorApi = await api("doctor");
    const tag = Date.now().toString(36);
    const patient = await createPatient(staffApi, tag);
    const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });

    const doctor = await as("doctor");
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
    await expect(doctor.getByRole("heading", { name: /SOAP & Chief Complaint/ })).toBeVisible();

    await doctor.getByPlaceholder("Chief Complaint*").fill("E2E allergies view — sore throat");
    await doctor.getByRole("heading", { name: /2\. Vital Signs/ }).click();
    await doctor.getByPlaceholder("Enter blood pressure").fill("118/76");
    await doctor.getByPlaceholder("Enter pulse rate").fill("72");
    await doctor.getByPlaceholder("Enter temperature").fill("37.0");
    await doctor.getByPlaceholder("Enter respiratory rate").fill("16");
    await doctor.getByPlaceholder("Enter o2 saturation").fill("99");
    await doctor.getByPlaceholder("Enter weight").fill("65");
    await doctor.getByPlaceholder("Enter height").fill("165");
    await doctor.getByRole("button", { name: "Save", exact: true }).click();
    await doctor.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(doctor.getByText(/Vitals saved at/)).toBeVisible();

    await doctor.getByRole("heading", { name: /3\. Diagnosis/ }).click();
    const dxInput = doctor.getByPlaceholder(/Diagnosis \(/);
    await dxInput.fill("Acute pharyngitis");
    const addButtons = doctor.getByRole("button", { name: "Add", exact: true });
    await (await addButtons.count()) > 1 ? addButtons.nth(1).click() : addButtons.click();
    await expect(doctor.getByText("Acute pharyngitis (Primary)")).toBeVisible();

    await doctor.getByRole("heading", { name: /4\. Prescription/ }).click();
    await doctor.getByText(/No medicines this visit/i).click();
    await doctor.locator("h3").filter({ hasText: /Follow-up/ }).click();
    await doctor.getByRole("button", { name: "Select date" }).click();
    await doctor.getByRole("button", { name: "Today" }).click();

    await doctor.getByRole("button", { name: "Complete Consultation", exact: true }).first().click();
    await doctor.getByRole("button", { name: "Confirm & Complete" }).click();
    await expect(doctor.getByText("Consultation saved")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status, { timeout: 15_000 })
      .toBe("Completed");
    const booking = await getBooking(doctorApi, ticket.booking_id);
    expect(booking.status).toBe("Completed");

    const allergen = `E2E allergen ${tag}`;
    await doctor.goto(`/doctor/consultation2/${ticket.booking_id}?mode=view`);
    //JJQR - AI (Oct 31, 2026) — allergy editor opens from sticky chip
    const allergyChip = doctor.locator("button[aria-controls='consult-allergy-editor-panel']");
    await allergyChip.click();
    const allergyInput = doctor.locator("#consult-allergy-draft");
    await expect(allergyInput).toBeVisible({ timeout: 15_000 });
    await allergyInput.fill(allergen);
    await doctor.getByRole("button", { name: "Add allergy" }).click();
    await expect(allergyChip).toContainText(/E2E allergen/i, { timeout: 15_000 });
    await allergyChip.click();
    await expect(doctor.locator("#consult-allergy-editor-panel")).toContainText(allergen, { timeout: 15_000 });

    await doctor.reload();
    await expect(allergyChip).toContainText(/E2E allergen/i, { timeout: 15_000 });
    await allergyChip.click();
    await expect(doctor.locator("#consult-allergy-editor-panel")).toContainText(allergen, { timeout: 15_000 });
    //JJQR - END
  });
});
//JJQR - END
