import path from "path";
import fs from "fs";
import { test, expect, type Page } from "../support/fixtures";
import {
  checkInWalkIn,
  createPatient,
  getConsultationByBooking,
  getBooking,
  type Role,
} from "../support/api";
import type { APIRequestContext } from "@playwright/test";
import {
  assertStillInAmendMode,
  completeConsultFromUi,
  confirmReviewSectionSave,
  enterAmendMode,
  fillRequiredConsultFields,
  openCompletedConsult,
  openSectionByTitle,
  showOccasionalSections,
  expandSoapSection,
  clickSoapToolbarSave,
  saveOpenSectionViaReview,
} from "../support/consultation-flow";

const SCREEN_DIR = path.join(process.cwd(), ".tmp-screens/completed-view");
const ARTIFACT_DIR = path.join(process.cwd(), "e2e/artifacts/completed-view");

async function seedAndComplete(
  as: (role: Role) => Promise<Page>,
  api: (role: Role) => Promise<APIRequestContext>,
  visitType: "New" | "FollowUp" = "New",
) {
  const staffApi = await api("staff");
  const doctorApi = await api("doctor");
  const tag = `${Date.now().toString(36)}-${visitType}`;
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id, { visit_type: visitType });
  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await fillRequiredConsultFields(doctor, `E2E ${visitType} ${tag}`);
  await completeConsultFromUi(doctor);
  await expect
    .poll(async () => (await getConsultationByBooking(doctorApi, ticket.booking_id))?.status, { timeout: 20_000 })
    .toBe("Completed");
  return { doctor, doctorApi, ticket, patient, tag };
}

test.describe.serial("consultation-regression-matrix — amend cluster", () => {
  let sharedBookingId: string;

  test("amend-enter-stays-edit", async ({ as, api }) => {
    const { doctor, ticket } = await seedAndComplete(as, api);
    sharedBookingId = ticket.booking_id;
    await openCompletedConsult(doctor, ticket.booking_id);
    await enterAmendMode(doctor);
  });

  test("amend-section-saves-stay", async ({ as }) => {
    test.setTimeout(180_000);
    const page = await as("doctor");
    await openCompletedConsult(page, sharedBookingId);
    await enterAmendMode(page);

    const sectionCases: { name: string; skip?: string; run: () => Promise<void> }[] = [
      {
        name: "SOAP",
        run: async () => {
          await expandSoapSection(page);
          await clickSoapToolbarSave(page);
          await confirmReviewSectionSave(page);
        },
      },
      {
        name: "Diagnosis",
        run: async () => {
          await openSectionByTitle(page, /3\. Diagnosis/i);
          await page.locator(".mt-md").getByRole("button", { name: "Save", exact: true }).first().click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm & Save" }).click();
        },
      },
      {
        name: "Follow-up",
        run: async () => {
          await page.locator("h3").filter({ hasText: /Follow-up/ }).click();
          await page.locator(".mt-md").getByRole("button", { name: "Save", exact: true }).first().click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm & Save" }).click();
        },
      },
      {
        name: "Professional Fee",
        run: async () => {
          await showOccasionalSections(page);
          await page.locator("h3").filter({ hasText: /Professional Fee/i }).click();
          await page.getByRole("button", { name: "Charge" }).click();
          await page.getByPlaceholder("Amount*").fill("500");
          await page.locator(".mt-md").getByRole("button", { name: "Save", exact: true }).first().click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm & Save" }).click();
        },
      },
      {
        name: "Vitals",
        run: async () => {
          await openSectionByTitle(page, /2\. Vital Signs/i);
          await page.getByRole("button", { name: "Save", exact: true }).click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
          await expect(page.getByText(/Vitals saved at/)).toBeVisible();
        },
      },
      {
        name: "Prescription",
        skip: "Empty Rx: PrescriptionForm Save requires line items; no-meds is a consultation gate only",
        run: async () => {},
      },
      {
        name: "Lab Orders",
        run: async () => {
          await openSectionByTitle(page, /5\. Lab Orders/i);
          const catalog = page.locator('input[type="checkbox"]').first();
          if (await catalog.count()) {
            await catalog.check();
          } else {
            await page.getByPlaceholder("Add another test").fill("E2E CBC");
            await page.getByRole("button", { name: "Add test" }).click();
          }
          await page.getByRole("button", { name: /Save without printing/i }).click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm & Save" }).click();
        },
      },
      {
        name: "Medical Certificate",
        run: async () => {
          await openSectionByTitle(page, /Medical Certificate/i);
          await page.getByRole("button", { name: /Save without printing/i }).click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm & Save" }).click();
        },
      },
      {
        name: "Vaccinations",
        run: async () => {
          await showOccasionalSections(page);
          await page.locator("h3").filter({ hasText: /Vaccinations/i }).click();
          await page.locator(".mt-md").getByRole("button", { name: "Save", exact: true }).first().click();
          await page.getByRole("dialog").getByRole("button", { name: "Confirm & Save" }).click();
        },
      },
    ];

    for (const c of sectionCases) {
      if (c.skip) {
        test.info().annotations.push({ type: "not-covered", description: `${c.name}: ${c.skip}` });
        continue;
      }
      await c.run();
      await assertStillInAmendMode(page, `after ${c.name} section save`);
    }
  });
});

test("new-consult-complete", async ({ as, api }) => {
  const { doctorApi, ticket } = await seedAndComplete(as, api, "New");
  const booking = await getBooking(doctorApi, ticket.booking_id);
  expect(booking.status).toBe("Completed");
});

test("follow-up-consult-complete", async ({ as, api }) => {
  const { doctorApi, ticket } = await seedAndComplete(as, api, "FollowUp");
  const booking = await getBooking(doctorApi, ticket.booking_id);
  expect(booking.status).toBe("Completed");
});

test("amend-section-save-persists", async ({ as, api }) => {
  const { doctor, ticket } = await seedAndComplete(as, api);
  await openCompletedConsult(doctor, ticket.booking_id);
  await enterAmendMode(doctor);
  await expandSoapSection(doctor);
  await doctor.getByPlaceholder("Assessment").fill("Persisted amend assessment E2E");
  await clickSoapToolbarSave(doctor);
  await confirmReviewSectionSave(doctor);
  await assertStillInAmendMode(doctor, "after assessment save");
  await doctor.reload();
  await openCompletedConsult(doctor, ticket.booking_id);
  await expect(doctor.getByText(/Persisted amend assessment E2E/)).toBeVisible();
});

test("amend-top-save-changes-exits", async ({ as, api }) => {
  const { doctor, ticket } = await seedAndComplete(as, api);
  await openCompletedConsult(doctor, ticket.booking_id);
  await enterAmendMode(doctor);
  await expandSoapSection(doctor);
  await doctor.getByPlaceholder("Chief Complaint*").fill("Top save exit tweak");
  await doctor.getByRole("button", { name: "Save Changes" }).click();
  await expect(doctor.getByRole("button", { name: "Edit Consultation" })).toBeVisible({ timeout: 20_000 });
  await expect(doctor.getByRole("button", { name: "Save Changes" })).toHaveCount(0);
});

test("amend-cancel-exits", async ({ as, api }) => {
  const { doctor, ticket } = await seedAndComplete(as, api);
  await openCompletedConsult(doctor, ticket.booking_id);
  await enterAmendMode(doctor);
  await doctor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(doctor.getByRole("button", { name: "Edit Consultation" })).toBeVisible();
});

test("amend-cancel-discard-dirty", async ({ as, api }) => {
  const { doctor, ticket } = await seedAndComplete(as, api);
  await openCompletedConsult(doctor, ticket.booking_id);
  await enterAmendMode(doctor);
  await doctor.getByPlaceholder("Chief Complaint*").fill("Should be discarded");
  await doctor.getByRole("button", { name: "Cancel", exact: true }).click();
  await doctor.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  await expect(doctor.getByRole("button", { name: "Edit Consultation" })).toBeVisible();
  await enterAmendMode(doctor);
  await expect(doctor.getByPlaceholder("Chief Complaint*")).not.toHaveValue("Should be discarded");
});

test("template-apply-soap", async ({ as, api }) => {
  const staffApi = await api("staff");
  const tag = Date.now().toString(36);
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id);
  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await openSectionByTitle(doctor, /1\. SOAP/i);
  const templateSelect = doctor.locator("select").filter({ has: doctor.locator('option', { hasText: /Use Template/ }) }).first();
  if (!(await templateSelect.count())) {
    test.fixme(true, "No SOAP template select on page");
    return;
  }
  const options = templateSelect.locator("option");
  const count = await options.count();
  let picked = false;
  for (let i = 0; i < count; i++) {
    const val = await options.nth(i).getAttribute("value");
    if (val) {
      await templateSelect.selectOption(val);
      picked = true;
      break;
    }
  }
  if (!picked) {
    test.fixme(true, "No SOAP templates in catalog");
    return;
  }
  await expect(doctor.getByPlaceholder("Assessment")).not.toHaveValue("");
});

test("completed-view-banner-diagnoses", async ({ as, api }) => {
  test.setTimeout(90_000);
  const { doctor, ticket, patient } = await seedAndComplete(as, api);
  await openCompletedConsult(doctor, ticket.booking_id);
  await expect(doctor.getByRole("heading", { name: new RegExp(patient.first_name) })).toBeVisible();
  await expect(doctor.getByRole("heading", { name: "Diagnoses" })).toBeVisible();
  await expect(doctor.getByText(/Acute pharyngitis/)).toBeVisible();

  fs.mkdirSync(SCREEN_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  for (const width of [390, 820, 1280, 1440] as const) {
    await doctor.setViewportSize({ width, height: width <= 820 ? 844 : 900 });
    await openCompletedConsult(doctor, ticket.booking_id);
    const shot = `completed-${width}.png`;
    await doctor.screenshot({ path: path.join(SCREEN_DIR, shot), fullPage: false });
    await doctor.screenshot({ path: path.join(ARTIFACT_DIR, shot), fullPage: false });

    const banner = doctor.locator(".sticky.top-16").first();
    const card = doctor.getByRole("heading", { name: "Diagnoses" }).locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
    const bannerBox = await banner.boundingBox();
    const cardBox = await card.boundingBox();
    expect(bannerBox, "banner visible").toBeTruthy();
    expect(cardBox, "diagnoses card visible").toBeTruthy();
    if (bannerBox && cardBox) {
      expect(Math.abs(bannerBox.x - cardBox.x)).toBeLessThanOrEqual(24);
    }
    const unpaid = doctor.getByText("Unpaid").first();
    if (await unpaid.isVisible()) {
      const chipBox = await unpaid.boundingBox();
      if (chipBox) expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(width - 4);
    }
  }
});

test("new-mode-section-save-stays", async ({ as, api }) => {
  const staffApi = await api("staff");
  const tag = Date.now().toString(36);
  const patient = await createPatient(staffApi, tag);
  const ticket = await checkInWalkIn(staffApi, patient.patient_id);
  const doctor = await as("doctor");
  await doctor.goto(`/doctor/consultation2/${ticket.booking_id}`);
  await expect(doctor.getByRole("button", { name: /1\. SOAP/i }).first()).toBeVisible({ timeout: 30_000 });
  await expandSoapSection(doctor);
  await doctor.getByPlaceholder("Chief Complaint*").fill("In progress save test");
  await clickSoapToolbarSave(doctor);
  await confirmReviewSectionSave(doctor);
  await expect(doctor.getByRole("button", { name: "Complete Consultation", exact: true }).first()).toBeVisible();
  await expect(doctor.getByRole("button", { name: "Edit Consultation" })).toHaveCount(0);
});
