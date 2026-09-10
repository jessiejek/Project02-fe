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

/** Best-effort teardown — delete the user's guest patient (cascades bookings/consultations). */
export async function deletePatient(api: APIRequestContext, patientId: string): Promise<void> {
  // No DELETE /api/patients yet; guest rows with no user just linger. Tag them
  // "E2E …" so they're greppable/clearable. If a delete endpoint lands, use it here.
  void api;
  void patientId;
}

export { ZERO_GUID };
