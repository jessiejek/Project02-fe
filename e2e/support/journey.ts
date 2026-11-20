import { expect, type Page } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { bookOnline, cancelQueueEntry, getBooking, getPaymentForBooking, manilaDate, registerFreshPatient } from "./api";
import { completeVisitViaApi, settleViaApi } from "./visit";

//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: COVERAGE-PLAN §4 journey 1 as a reusable function (desktop, iPad and phone variants share it)
interface Env {
  as: (r: "staff" | "doctor" | "admin" | "patient") => Promise<Page>;
  loginAs: (email: string, password: string) => Promise<Page>;
  api: (r: "staff" | "doctor" | "admin" | "patient") => Promise<APIRequestContext>;
  tag: (l?: string) => string;
  cleanup: (f: () => unknown) => void;
}

/**
 * Patient books today (online) → staff checks the patient in (UI) → doctor consults and completes (API, same endpoints as the UI)
 * → staff records the payment (UI) → patient sees record, Rx and booking (UI) → the audit log holds each step (API).
 * `staffUi` toggles the staff UI steps (the phone variant only drives the patient portal).
 */
export async function journeyOne(env: Env, opts: { staffUi?: boolean; label?: string } = {}) {
  const { as, loginAs, api, tag, cleanup } = env;
  const staffUi = opts.staffUi ?? true;
  const staff = await api("staff");
  const doctor = await api("doctor");
  const admin = await api("admin");
  const complaint = tag(opts.label ?? "j1");
  const me = await registerFreshPatient(tag("j1p"));
  cleanup(() => me.dispose());

  // 1 · patient books today
  const { body, status } = await bookOnline(me.api, manilaDate());
  expect([200, 201]).toContain(status);
  const bookingId = body.booking_id as string;
  cleanup(() => cancelQueueEntry(staff, bookingId));
  const conf = await staff.put(`/api/bookings/${bookingId}/status`, { data: { status: "Confirmed" } });
  expect(conf.ok(), await conf.text()).toBeTruthy();

  // 2 · staff checks in
  if (staffUi) {
    const sp = await as("staff");
    await sp.goto(`/staff/bookings/${bookingId}`);
    await sp.getByRole("button", { name: "Check in" }).click();
    await expect.poll(async () => (await getBooking(staff, bookingId)).status).toBe("CheckedIn");
  } else {
    const r = await staff.put(`/api/queue/${bookingId}/check-in`);
    expect(r.ok(), await r.text()).toBeTruthy();
  }

  // 3 · doctor consults and completes
  const visit = await completeVisitViaApi({ staff, doctor }, me.patientId, { bookingId, complaint, rx: true, diagnosis: `${complaint}-dx` });
  cleanup(() => settleViaApi(staff, bookingId));
  expect((await getBooking(staff, bookingId)).status).toBe("Completed");

  // 4 · staff records payment
  if (staffUi) {
    const sp = await as("staff");
    await sp.goto(`/staff/bookings/${bookingId}`);
    await sp.getByRole("button", { name: "Record payment" }).click();
    const d = sp.getByRole("dialog", { name: /Record payment of/ });
    await d.getByRole("button", { name: "Record payment" }).click();
    await expect(sp.getByRole("dialog", { name: "Receipt" })).toBeVisible();
  } else {
    await settleViaApi(staff, bookingId);
  }
  expect((await getPaymentForBooking(staff, bookingId)).status).toBe("Paid");

  // 5 · patient sees it
  const pp = await loginAs(me.email, me.password);
  await pp.goto("/patient/medical-records");
  await expect(pp.getByRole("button", { name: new RegExp(`${complaint}-dx`) })).toBeVisible();
  await pp.goto("/patient/prescriptions");
  await expect(pp.getByText(new RegExp(visit.medicine!.split(" ")[0])).first()).toBeVisible();
  await pp.goto("/patient/bookings");
  await expect(pp.getByText(/Completed/).first()).toBeVisible();

  // 6 · audit log holds the steps for this booking
  const res = await admin.get(`/api/audit-logs/search?entityType=Booking&pageSize=100`);
  expect(res.ok()).toBeTruthy();
  const items: any[] = (await res.json()).items;
  const mine = items.filter((i) => i.entity_id === bookingId);
  expect(mine.length, `audit rows for ${bookingId}`).toBeGreaterThanOrEqual(2);
  expect(mine.map((i) => i.action).join("|")).toMatch(/Booked/);
  return { bookingId, me, visit };
}
//JJQR - END
