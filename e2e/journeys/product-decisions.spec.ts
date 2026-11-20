import { test, expect } from "../support/fixtures";
import { checkInWalkIn, createPatient, getBooking, getConsultationByBooking } from "../support/api";
import { completeConsultFromUi, fillRequiredConsultFields, showOccasionalSections } from "../support/consultation-flow";

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
    const input = page.getByPlaceholder("Search…");
    // Unique tag avoids cap-8 collision with older E2E rows
    await input.fill(patient.first_name);
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("listbox").getByRole("option").filter({ hasText: patient.first_name })).not.toHaveCount(0, { timeout: 15_000 });
  });

  //JJQR - AI (Nov 20, 2026) - batch 2: the redesign (consult-uiux #5) deliberately moved Vaccinations + Professional Fee behind "More"; this test now asserts that
  test("vaccinations section is behind More on the step bar and appears when More is opened", async ({ as, api }) => {
    const staffApi = await api("staff");
    const tag = Date.now().toString(36);
    const patient = await createPatient(staffApi, tag);
    const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: "New" });
    const page = await as("doctor");
    await page.goto(`/doctor/consultation2/${ticket.booking_id}?mode=complete`);
    const steps = page.getByRole("navigation", { name: "Consultation sections" });
    await expect(steps.getByRole("button", { name: /1\. Clinical notes/ })).toBeVisible({ timeout: 15_000 });
    await expect(steps.getByRole("button", { name: /Vaccinations/ })).toHaveCount(0);
    await showOccasionalSections(page);
    await expect(steps.getByRole("button", { name: /Vaccinations/ })).toBeVisible();
  });
  //JJQR - END

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
    //JJQR - AI (Nov 20, 2026) - batch 2: the page's button is "Cancel booking" and its modal has a labelled Reason box
    await expect(page.getByRole("button", { name: "Cancel booking" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Cancel booking" }).click();
    const dlg = page.getByRole("dialog", { name: /Cancel this booking/i });
    await expect(dlg).toBeVisible();
    await dlg.getByLabel(/Reason/).fill("E2E schedule conflict");
    await dlg.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByText("Cancelled").first()).toBeVisible({ timeout: 15_000 });
    //JJQR - END
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
    await fillRequiredConsultFields(doctor, "E2E allergies view — sore throat");
    await completeConsultFromUi(doctor);
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
