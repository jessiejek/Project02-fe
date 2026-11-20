import { test, expect } from "../support/fixtures";
import { createPatient, checkInWalkIn, getBooking } from "../support/api";

//JJQR - AI (Nov 19, 2026) - Phase 5 (items 1-6): the API now forces a Doctor to their OWN doctor id on the bookings / consultations /
// prescription-groups / lab-orders / medical-certificates / follow-ups lists and on three reports. This proves (a) the doctor pages that read
// those lists still work with real data, (b) a spoofed doctorId is ignored, and (c) staff still see the whole clinic.

const LISTS = ["bookings", "consultations", "prescription-groups", "lab-orders", "medical-certificates", "follow-ups"] as const;

test.describe("doctor scope · pages and lists", () => {
  test("a doctor's pages still load their own data, lists are forced to the doctor, staff are unaffected @global", async ({ as, api }) => {
    const tag = Math.random().toString(36).slice(2, 9);
    const staffApi = await api("staff");
    const doctorApi = await api("doctor");

    // a patient checked in and a consultation started for the dev doctor
    const patient = await createPatient(staffApi, tag);
    const ticket = await checkInWalkIn(staffApi, patient.patient_id);
    const booking = await getBooking(staffApi, ticket.booking_id);
    const doctorId = booking.doctor_id as string;
    const put = await doctorApi.put(`/api/consultations/by-booking/${ticket.booking_id}`, {
      data: { patient_id: patient.patient_id, doctor_id: doctorId, status: "Draft", chief_complaint: `E2E scope ${tag}` },
    });
    expect(put.ok(), `consultation upsert → ${put.status()}`).toBeTruthy();

    // API: every list is the doctor's own rows, a spoofed doctorId changes nothing, staff see everything
    const strangerId = "00000000-0000-0000-0000-0000000000aa";
    for (const list of LISTS) {
      const own = await doctorApi.get(`/api/${list}`);
      expect(own.status(), `${list} (doctor)`).toBe(200);
      const rows = (await own.json()) as { doctor_id?: string }[];
      for (const r of rows) expect(r.doctor_id, `${list} row owner`).toBe(doctorId);
      const spoofed = await doctorApi.get(`/api/${list}?doctorId=${strangerId}`);
      expect(spoofed.status(), `${list} (doctor, spoofed id)`).toBe(200);
      expect(((await spoofed.json()) as unknown[]).length, `${list} spoofed`).toBe(rows.length);
    }
    const mine = (await (await doctorApi.get("/api/bookings")).json()) as { booking_id: string }[];
    expect(mine.some((b) => b.booking_id === ticket.booking_id)).toBe(true);
    const staffBookings = (await (await staffApi.get("/api/bookings")).json()) as { booking_id: string }[];
    expect(staffBookings.some((b) => b.booking_id === ticket.booking_id)).toBe(true);
    for (const report of ["daily-booking-summary", "unpaid-completed-visits", "pending-follow-ups"]) {
      expect((await doctorApi.get(`/api/reports/${report}`)).status(), `report ${report} (doctor)`).toBe(200);
      expect((await staffApi.get(`/api/reports/${report}`)).status(), `report ${report} (staff)`).toBe(200);
    }

    // UI: the doctor's pages that read these lists
    const page = await as("doctor");
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400 && /\/api\//.test(r.url()) && !/v_doctor_earnings|doctor-earnings/.test(r.url())) failed.push(`${r.status()} ${r.url()}`);
    });

    await page.goto("/doctor/appointments");
    //JJQR - AI (Nov 20, 2026) - batch 2: today's list is long on a shared dev DB (paged) — search for the patient first
    await page.getByRole("searchbox", { name: /Search patients/ }).fill(`E2E ${tag}`);
    await expect(page.getByText(`E2E ${tag} Tester`).first()).toBeVisible();
    //JJQR - END

    await page.goto("/doctor/schedule");
    await expect(page.locator("h1, h2").first()).toBeVisible();

    await page.goto(`/doctor/consultation2/${ticket.booking_id}`);
    //JJQR - AI (Nov 20, 2026) - batch 2: the redesigned patient banner no longer prints the name as one text node
    await expect(page.getByText(new RegExp(`E2E ${tag}.*Tester`, "i")).first()).toBeVisible();
    //JJQR - END
    await page.getByRole("button", { name: "View Patient History" }).click();
    const history = page.getByRole("dialog");
    await expect(history).toContainText("Patient History");
    await expect(history.getByText("Patient history unavailable")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto(`/doctor/patients/${patient.patient_id}`);
    await expect(page.getByText(`E2E ${tag} Tester`).first()).toBeVisible();
    await expect(page.getByText(/could not be loaded|unavailable/i)).toHaveCount(0);

    expect(failed, `failed API calls: ${failed.join(" | ")}`).toEqual([]);
  });
});
//JJQR - END
