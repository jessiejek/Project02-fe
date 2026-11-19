import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import { BE_URL, DEV_PASSWORD } from "../playwright.config";

export type Role = "admin" | "staff" | "doctor" | "patient";
const EMAIL: Record<Role, string> = {
  admin: "admin@clinic.test",
  staff: "staff@clinic.test",
  doctor: "doctor@clinic.test",
  patient: "patient@clinic.test",
};

const tokenCache = new Map<Role, string>();

/** Raw .NET access token for a dev role (cached for the run). */
export async function token(role: Role): Promise<string> {
  const cached = tokenCache.get(role);
  if (cached) return cached;
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${BE_URL}/api/auth/login`, {
    data: { email: EMAIL[role], password: DEV_PASSWORD },
  });
  if (!res.ok()) throw new Error(`login ${role} → ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  const t = body.accessToken as string;
  tokenCache.set(role, t);
  return t;
}

/** An APIRequestContext pre-authorised as `role`, based at the .NET API. */
export async function apiAs(role: Role): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${await token(role)}` },
  });
}

const ZERO_GUID = "00000000-0000-0000-0000-000000000000";

export interface SeededPatient {
  patient_id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
}

/** Create a fresh guest patient with a unique name. */
export async function createPatient(api: APIRequestContext, tag: string): Promise<SeededPatient> {
  const res = await api.post("/api/patients", {
    data: {
      first_name: `E2E ${tag}`,
      last_name: "Tester",
      date_of_birth: "1990-01-01",
      sex: "Male",
      contact_number: "09170000000",
      email: `e2e-${tag}@example.com`,
      is_guest: true,
      user_id: null,
    },
  });
  if (!res.ok()) throw new Error(`createPatient → ${res.status()} ${await res.text()}`);
  return res.json();
}

export interface QueueTicket {
  booking_id: string;
  queue_number: string;
  provisional_fee: number;
}

/** Check a patient into today's walk-in queue. */
export async function checkInWalkIn(
  api: APIRequestContext,
  patientId: string,
  opts: { visit_type?: "New" | "FollowUp"; med_cert_requested?: boolean; discount_category?: "Senior" | "PWD" | null } = {},
): Promise<QueueTicket> {
  const res = await api.post("/api/queue", {
    data: {
      patient_id: patientId,
      visit_type: opts.visit_type ?? "New",
      med_cert_requested: opts.med_cert_requested ?? false,
      discount_category: opts.discount_category ?? null,
    },
  });
  if (!res.ok()) throw new Error(`checkInWalkIn → ${res.status()} ${await res.text()}`);
  return res.json();
}

export async function getBooking(api: APIRequestContext, bookingId: string) {
  const res = await api.get(`/api/bookings/${bookingId}`);
  if (!res.ok()) throw new Error(`getBooking → ${res.status()}`);
  return res.json();
}

export async function getConsultationByBooking(api: APIRequestContext, bookingId: string) {
  const res = await api.get(`/api/consultations/by-booking/${bookingId}`);
  return res.ok() ? res.json() : null;
}

export async function getRxGroups(api: APIRequestContext, patientId: string) {
  const res = await api.get(`/api/prescription-groups?patientId=${patientId}`);
  return res.ok() ? res.json() : [];
}

export async function getVitals(api: APIRequestContext, bookingId: string): Promise<Record<string, unknown>[]> {
  const res = await api.get(`/api/vitals?bookingId=${bookingId}`);
  return res.ok() ? res.json() : [];
}

export async function getLabOrders(api: APIRequestContext, bookingId: string): Promise<Record<string, unknown>[]> {
  const res = await api.get(`/api/lab-orders/by-booking/${bookingId}`);
  return res.ok() ? res.json() : [];
}

export async function getMedicalCertificate(
  api: APIRequestContext,
  bookingId: string,
): Promise<Record<string, unknown> | null> {
  const res = await api.get(`/api/medical-certificates/by-booking/${bookingId}`);
  return res.ok() ? res.json() : null;
}

export async function getVaccinations(api: APIRequestContext, patientId: string): Promise<Record<string, unknown>[]> {
  const res = await api.get(`/api/patient-vaccinations?patientId=${patientId}`);
  return res.ok() ? res.json() : [];
}

/** Best-effort teardown — delete the user's guest patient (cascades bookings/consultations). */
export async function deletePatient(api: APIRequestContext, patientId: string): Promise<void> {
  // No DELETE /api/patients yet; guest rows with no user just linger. Tag them
  // "E2E …" so they're greppable/clearable. If a delete endpoint lands, use it here.
  void api;
  void patientId;
}



//JJQR - AI (Nov 19, 2026) - e2e-full-coverage helpers: tagged data, fresh patient accounts, Manila dates, payment/queue shortcuts
export { ZERO_GUID };

/** YYYY-MM-DD in Asia/Manila, `offsetDays` from today. */
export function manilaDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export const PASSWORD = "E2e-Passw0rd!";

/** Create a patient with a tagged name (visible in search as `<tag> Tester`). */
export async function createTaggedPatient(api: APIRequestContext, tag: string, extra: Record<string, unknown> = {}): Promise<SeededPatient> {
  const res = await api.post("/api/patients", {
    data: {
      first_name: tag,
      last_name: "Tester",
      date_of_birth: "1990-01-01",
      sex: "Male",
      contact_number: "09170000000",
      email: `${tag.toLowerCase()}@example.test`,
      is_guest: true,
      user_id: null,
      ...extra,
    },
  });
  if (!res.ok()) throw new Error(`createTaggedPatient → ${res.status()} ${await res.text()}`);
  return res.json();
}

export interface FreshPatient {
  email: string;
  password: string;
  userId: string;
  patientId: string;
  firstName: string;
  api: APIRequestContext;
  /** Delete the login (the patient row lingers — there is no patient-delete endpoint). */
  dispose(): Promise<void>;
}

/** Register a brand-new self-service patient account via the public API (the same call /register makes). */
export async function registerFreshPatient(tag: string, over: Record<string, unknown> = {}): Promise<FreshPatient> {
  const email = `${tag.toLowerCase()}@example.test`;
  const anon = await pwRequest.newContext({ baseURL: BE_URL });
  let res = await anon.post("/api/auth/register", {
    data: { firstName: tag, lastName: "Tester", dateOfBirth: "1990-01-01", sex: "Female", contactNumber: "09171112222", email, password: PASSWORD, ...over },
  });
  // The API's /api/auth/* limit is per minute per IP (120 in Development). A long run can touch it: wait out the window, then retry.
  for (let i = 0; i < 5 && res.status() === 429; i++) {
    await new Promise((r) => setTimeout(r, 15_000));
    res = await anon.post("/api/auth/register", {
      data: { firstName: tag, lastName: "Tester", dateOfBirth: "1990-01-01", sex: "Female", contactNumber: "09171112222", email, password: PASSWORD, ...over },
    });
  }
  if (!res.ok()) throw new Error(`register ${tag} → ${res.status()} ${await res.text()}`);
  const session = await res.json();
  await anon.dispose();
  const api = await pwRequest.newContext({ baseURL: BE_URL, extraHTTPHeaders: { Authorization: `Bearer ${session.accessToken}` } });
  const me = await api.get("/api/patients/me");
  const patientId = (await me.json()).patient_id as string;
  return {
    email, password: PASSWORD, userId: session.user.id, patientId, firstName: tag, api,
    async dispose() {
      await api.dispose();
      const admin = await apiAs("admin");
      await admin.delete(`/api/auth/users/${session.user.id}`).catch(() => undefined);
      await admin.dispose();
    },
  };
}

/** Log a fresh browser context in through the real /login form. */
export async function loginViaUi(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function getPaymentForBooking(api: APIRequestContext, bookingId: string): Promise<Record<string, any>> {
  const res = await api.get(`/api/payments/booking/${bookingId}`);
  if (!res.ok()) throw new Error(`getPaymentForBooking → ${res.status()}`);
  return res.json();
}

/** Best-effort: cancel a queue entry (before paid). Falls back to the booking status endpoint (needed for "Confirmed"). */
export async function cancelQueueEntry(api: APIRequestContext, bookingId: string, reason = "E2E cleanup") {
  const r = await api.put(`/api/queue/${bookingId}/cancel`, { data: { reason } }).catch(() => undefined);
  if (r?.ok()) return;
  await api.put(`/api/bookings/${bookingId}/status`, { data: { status: "Cancelled", reason } }).catch(() => undefined);
}

export interface QueueItem {
  booking_id: string; queue_number: string; patient_id: string; patient_name: string; patient_code: string;
  status: string; visit_type: string; amount_due: number; is_walk_in: boolean;
}
/** Today's queue board (staff/admin). */
export async function getQueue(api: APIRequestContext): Promise<{ summary: Record<string, number>; items: QueueItem[] }> {
  const res = await api.get("/api/queue");
  if (!res.ok()) throw new Error(`getQueue → ${res.status()}`);
  return res.json();
}
/** Cancel every still-open queue entry whose patient name contains `needle` (cleanup for UI-created walk-ins). */
export async function cancelQueueByName(api: APIRequestContext, needle: string) {
  const { items } = await getQueue(api);
  for (const it of items.filter((i) => i.patient_name.toLowerCase().includes(needle.toLowerCase()) && !["Completed", "Cancelled", "NoShow"].includes(i.status))) {
    await cancelQueueEntry(api, it.booking_id);
  }
}
export async function queueFor(api: APIRequestContext, needle: string): Promise<QueueItem[]> {
  return (await getQueue(api)).items.filter((i) => i.patient_name.toLowerCase().includes(needle.toLowerCase()));
}

/** A patient books via the real online endpoint. */
export async function bookOnline(api: APIRequestContext, date?: string, notes?: string) {
  const res = await api.post("/api/bookings/book", { data: { appointment_date: date, visit_type: "New", notes } });
  return { res, status: res.status(), body: await res.json().catch(() => ({})) };
}

/** Patient cancels their own (not-yet-checked-in) booking. Best effort. */
export async function cancelOwnBooking(api: APIRequestContext, bookingId: string) {
  await api.put(`/api/bookings/${bookingId}/cancel`, { data: { reason: "E2E cleanup" } }).catch(() => undefined);
}

export async function getSettings(api: APIRequestContext): Promise<Record<string, any>> {
  return (await api.get("/api/settings")).json();
}
export async function putSettings(api: APIRequestContext, body: Record<string, unknown>) {
  return api.put("/api/settings", { data: body });
}
export async function getDoctor(api: APIRequestContext): Promise<Record<string, any>> {
  const list = await (await api.get("/api/doctors")).json();
  return list[0];
}

/** Delete a self-registered login by e-mail (patient row lingers). Best effort; used in cleanup. */
export async function deleteAccountByEmail(email: string, password = PASSWORD): Promise<void> {
  const anon = await pwRequest.newContext({ baseURL: BE_URL });
  try {
    const r = await anon.post("/api/auth/login", { data: { email, password } });
    if (!r.ok()) return;
    const id = (await r.json()).user.id as string;
    const admin = await apiAs("admin");
    await admin.delete(`/api/auth/users/${id}`).catch(() => undefined);
    await admin.dispose();
  } finally {
    await anon.dispose();
  }
}
//JJQR - END

//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: announcements + dev password helpers
/** Create an announcement as admin; returns its id. Caller registers cleanup with deleteAnnouncement. */
export async function createAnnouncement(admin: APIRequestContext, title: string, body = "E2E body", is_active = true): Promise<{ id: string }> {
  const res = await admin.post("/api/announcements", { data: { title, body, is_active } });
  if (!res.ok()) throw new Error(`createAnnouncement → ${res.status()} ${await res.text()}`);
  return res.json();
}
export async function deleteAnnouncement(admin: APIRequestContext, id: string) {
  await admin.delete(`/api/announcements/${id}`).catch(() => undefined);
}
/** Delete every announcement whose title contains `needle` (cleanup for UI-created rows). */
export async function deleteAnnouncementsByTitle(admin: APIRequestContext, needle: string) {
  const res = await admin.get("/api/announcements?activeOnly=false");
  if (!res.ok()) return;
  for (const a of (await res.json()) as { id: string; title: string }[]) if (a.title.includes(needle)) await deleteAnnouncement(admin, a.id);
}

/** Cleanup guard for tests that change a dev account's password: puts ClinicDev123! back whichever password is current. */
export async function restoreDevPassword(email: string, candidates: string[]): Promise<void> {
  for (const pw of [DEV_PASSWORD, ...candidates]) {
    const ctx = await pwRequest.newContext({ baseURL: BE_URL });
    const r = await ctx.post("/api/auth/login", { data: { email, password: pw } });
    if (r.ok()) {
      const tok = (await r.json()).accessToken as string;
      if (pw !== DEV_PASSWORD) {
        await ctx.post("/api/auth/change-password", { data: { currentPassword: pw, newPassword: DEV_PASSWORD }, headers: { Authorization: `Bearer ${tok}` } });
      }
      await ctx.dispose();
      return;
    }
    await ctx.dispose();
  }
}
//JJQR - END

//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: admin-side helpers (staff accounts, patients, bookings)
export async function staffAccountByEmail(admin: APIRequestContext, email: string): Promise<Record<string, any> | undefined> {
  const rows: any[] = await (await admin.get("/api/staff-accounts")).json();
  return rows.find((r) => String(r.email).toLowerCase() === email.toLowerCase());
}
/** Delete an invited/test staff login by e-mail (best effort, never touches the four dev logins). */
export async function deleteStaffByEmail(admin: APIRequestContext, email: string) {
  if (/@clinic\.test$/i.test(email)) return;
  const row = await staffAccountByEmail(admin, email);
  if (row) await admin.delete(`/api/auth/users/${row.user_id}`);
}
export async function patientsMatching(api: APIRequestContext, needle: string): Promise<any[]> {
  const res = await api.get(`/api/patients?search=${encodeURIComponent(needle)}`);
  const body = await res.json();
  return Array.isArray(body) ? body : body.items ?? body.data ?? [];
}
//JJQR - END

//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: wait for the per-minute /api/auth/* rate-limit window to have room (login-form tests must see the real error, not a 429)
export async function waitForAuthBudget(): Promise<void> {
  const ctx = await pwRequest.newContext({ baseURL: BE_URL });
  try {
    for (let i = 0; i < 8; i++) {
      const r = await ctx.post("/api/auth/login", { data: { email: "nobody-e2e-probe@example.test", password: "x" } });
      if (r.status() !== 429) return;
      await new Promise((res) => setTimeout(res, 10_000));
    }
  } finally {
    await ctx.dispose();
  }
}
//JJQR - END
