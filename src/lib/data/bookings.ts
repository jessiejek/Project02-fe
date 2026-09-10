/**
 * Booking reads (INTEGRATION_ROADMAP.md Phase 4b).
 *
 * Every variant returns the canonical contract row (§4) with the full §6 nested
 * embeds, from either backend, so page code keeps reading `b.doctors?.staff_accounts?.full_name`,
 * `b.booking_services`, `b.payments?.status` etc. unchanged.
 *
 * The .NET paged endpoints ({ items, totalCount }) are unwrapped here.
 */
import { api } from "@/lib/api/client";

// The leading `_supabase` parameter is a migration vestige (callers pass
// `null as never`); everything is served by the .NET /api/bookings* endpoints.

type Raw = Record<string, unknown>;

/** PostgREST many-to-one embeds come back as object OR 1-element array. */
function one(v: unknown): Raw | null {
  const x = Array.isArray(v) ? v[0] : v;
  return x && typeof x === "object" ? (x as Raw) : null;
}

export interface BookingPatientEmbed {
  first_name: string | null;
  last_name: string | null;
  patient_code: string | null;
  contact_number: string | null;
  email: string | null;
  sex: string | null;
  date_of_birth: string | null;
}
export interface BookingDoctorEmbed {
  specialization: string | null;
  consultation_fee: number | null;
  slot_duration_minutes: number | null;
  staff_accounts: { full_name: string | null } | null;
}
export interface BookingServiceEmbed {
  service_id?: string;
  price_at_booking?: number;
  services: { name: string | null; price: number | null; category: string | null } | null;
}
export interface BookingPaymentEmbed {
  status: string | null;
  waived_reason: string | null;
  or_number: string | null;
  amount: number | null;
  payment_method: string | null;
}

export interface BookingRow {
  booking_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  slot_start_time: string;
  slot_end_time: string;
  status: string;
  payment_mode: string;
  queue_number: string | null;
  consultation_fee_snapshot: number;
  total_fee: number;
  amount_due: number;
  is_walk_in: boolean;
  // §16.6 fee-line fields (Phase 8.4).
  visit_type: "New" | "FollowUp";
  discount_category: "Senior" | "PWD" | null;
  discount_amount: number;
  med_cert_requested: boolean;
  proof_type: string | null;
  proof_value: string | null;
  proof_submitted_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patients: BookingPatientEmbed | null;
  doctors: BookingDoctorEmbed | null;
  booking_services: BookingServiceEmbed[];
  payments: BookingPaymentEmbed | null;
}

function projectDoctor(raw: unknown): BookingDoctorEmbed | null {
  const d = one(raw);
  if (!d) return null;
  const sa = one(d.staff_accounts);
  return {
    specialization: (d.specialization as string) ?? null,
    consultation_fee: d.consultation_fee == null ? null : Number(d.consultation_fee),
    slot_duration_minutes: d.slot_duration_minutes == null ? null : Number(d.slot_duration_minutes),
    staff_accounts: sa ? { full_name: (sa.full_name as string) ?? null } : null,
  };
}

function projectBooking(raw: Raw): BookingRow {
  const p = one(raw.patients);
  const pay = one(raw.payments);
  const bs = (Array.isArray(raw.booking_services) ? raw.booking_services : []) as Raw[];
  return {
    booking_id: String(raw.booking_id ?? ""),
    patient_id: String(raw.patient_id ?? ""),
    doctor_id: String(raw.doctor_id ?? ""),
    appointment_date: String(raw.appointment_date ?? ""),
    slot_start_time: String(raw.slot_start_time ?? ""),
    slot_end_time: String(raw.slot_end_time ?? ""),
    status: String(raw.status ?? ""),
    payment_mode: String(raw.payment_mode ?? ""),
    queue_number: (raw.queue_number as string) ?? null,
    consultation_fee_snapshot: Number(raw.consultation_fee_snapshot ?? 0),
    total_fee: Number(raw.total_fee ?? 0),
    amount_due: Number(raw.amount_due ?? 0),
    is_walk_in: Boolean(raw.is_walk_in),
    visit_type: (raw.visit_type as "New" | "FollowUp") ?? "New",
    discount_category: (raw.discount_category as "Senior" | "PWD" | null) ?? null,
    discount_amount: Number(raw.discount_amount ?? 0),
    med_cert_requested: Boolean(raw.med_cert_requested),
    proof_type: (raw.proof_type as string) ?? null,
    proof_value: (raw.proof_value as string) ?? null,
    proof_submitted_at: (raw.proof_submitted_at as string) ?? null,
    cancelled_by_user_id: (raw.cancelled_by_user_id as string) ?? null,
    cancellation_reason: (raw.cancellation_reason as string) ?? null,
    notes: (raw.notes as string) ?? null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    patients: p
      ? {
          first_name: (p.first_name as string) ?? null,
          last_name: (p.last_name as string) ?? null,
          patient_code: (p.patient_code as string) ?? null,
          contact_number: (p.contact_number as string) ?? null,
          email: (p.email as string) ?? null,
          sex: (p.sex as string) ?? null,
          date_of_birth: (p.date_of_birth as string) ?? null,
        }
      : null,
    doctors: projectDoctor(raw.doctors),
    booking_services: bs.map((r) => {
      const svc = one(r.services);
      return {
        service_id: r.service_id as string | undefined,
        price_at_booking: r.price_at_booking == null ? undefined : Number(r.price_at_booking),
        services: svc
          ? {
              name: (svc.name as string) ?? null,
              price: svc.price == null ? null : Number(svc.price),
              category: (svc.category as string) ?? null,
            }
          : null,
      };
    }),
    payments: pay
      ? {
          status: (pay.status as string) ?? null,
          waived_reason: (pay.waived_reason as string) ?? null,
          or_number: (pay.or_number as string) ?? null,
          amount: pay.amount == null ? null : Number(pay.amount),
          payment_method: (pay.payment_method as string) ?? null,
        }
      : null,
  };
}

function unwrap<T>(res: T[] | { items?: T[] }): T[] {
  return Array.isArray(res) ? res : (res.items ?? []);
}

type BookingFilters = {
  patientId?: string;
  doctorId?: string;
  date?: string;
  /** inclusive appointment_date range (YYYY-MM-DD). */
  from?: string;
  to?: string;
  status?: string;
};

/** Generic filtered list. */
export async function queryBookings(
  _supabase: unknown,
  filters: BookingFilters = {},
): Promise<BookingRow[]> {
  const rows = await api.get<Raw[]>("/api/bookings", {
    query: {
      patientId: filters.patientId,
      doctorId: filters.doctorId,
      date: filters.date,
      from: filters.from,
      to: filters.to,
      status: filters.status,
    },
  });
  return rows.map(projectBooking);
}

/** The logged-in patient's bookings. */
export async function queryMyBookings(_supabase: unknown, _patientId: string): Promise<BookingRow[]> {
  const res = await api.get<{ items?: Raw[] }>("/api/bookings/me", { query: { pageSize: 500 } });
  return unwrap(res).map(projectBooking);
}

/** Staff/admin list: all, today, or unpaid-for-payment. */
export async function queryStaffBookings(
  _supabase: unknown,
  scope: "all" | "today" | "for-payment" = "all",
  opts: { q?: string } = {},
): Promise<BookingRow[]> {
  const res = await api.get<{ items?: Raw[] }>(`/api/bookings/staff/${scope}`, {
    query: { pageSize: 500, q: opts.q || undefined },
  });
  return unwrap(res).map(projectBooking);
}

/** The logged-in doctor's bookings (all, or just today). */
export async function queryDoctorBookings(
  _supabase: unknown,
  doctorId: string,
  opts: { today?: boolean } = {},
): Promise<BookingRow[]> {
  const path = opts.today ? "/api/bookings/doctor/today" : "/api/bookings";
  const rows = await api.get<Raw[]>(path, { query: opts.today ? undefined : { doctorId } });
  return rows.map(projectBooking);
}

/**
 * Booking status transition (Phase 4c). .NET: PUT /api/bookings/{id}/status
 * `{ status, reason }`.
 */
export async function updateBookingStatus(
  _supabase: unknown,
  bookingId: string,
  status: string,
  opts: { reason?: string } = {},
): Promise<void> {
  await api.put(`/api/bookings/${bookingId}/status`, { status, reason: opts.reason ?? null });
}

export async function queryBookingById(_supabase: unknown, bookingId: string): Promise<BookingRow | null> {
  try {
    return projectBooking(await api.get<Raw>(`/api/bookings/${bookingId}`));
  } catch {
    return null;
  }
}
