/**
 * Booking reads (INTEGRATION_ROADMAP.md Phase 4b).
 *
 * Every variant returns the canonical contract row (§4) with the full §6 nested
 * embeds, from either backend, so page code keeps reading `b.doctors?.staff_accounts?.full_name`,
 * `b.booking_services`, `b.payments?.status` etc. unchanged.
 *
 * The .NET paged endpoints ({ items, totalCount }) are unwrapped here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";

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

// Full §6 embed select used against Supabase; the .NET WithEmbeds() already
// returns the equivalent nested shape.
const SELECT = `*,
  patients(first_name, last_name, patient_code, contact_number, email, sex, date_of_birth),
  doctors(specialization, consultation_fee, slot_duration_minutes, staff_accounts(full_name)),
  booking_services(service_id, price_at_booking, services(name, price, category)),
  payments(status, waived_reason, or_number, amount, payment_method)`;

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
  status?: string;
};

/** Generic filtered list. */
export async function queryBookings(
  supabase: SupabaseClient,
  filters: BookingFilters = {},
): Promise<BookingRow[]> {
  if (resolveMode("bookings") === "dotnet") {
    const rows = await api.get<Raw[]>("/api/bookings", {
      query: {
        patientId: filters.patientId,
        doctorId: filters.doctorId,
        date: filters.date,
        status: filters.status,
      },
    });
    return rows.map(projectBooking);
  }
  let q = supabase.from("bookings").select(SELECT);
  if (filters.patientId) q = q.eq("patient_id", filters.patientId);
  if (filters.doctorId) q = q.eq("doctor_id", filters.doctorId);
  if (filters.date) q = q.eq("appointment_date", filters.date);
  if (filters.status) q = q.eq("status", filters.status);
  const { data } = await q.order("appointment_date", { ascending: false }).order("slot_start_time", { ascending: false });
  return (data ?? []).map((r) => projectBooking(r as Raw));
}

/** The logged-in patient's bookings. */
export async function queryMyBookings(supabase: SupabaseClient, patientId: string): Promise<BookingRow[]> {
  if (resolveMode("bookings") === "dotnet") {
    const res = await api.get<{ items?: Raw[] }>("/api/bookings/me", { query: { pageSize: 500 } });
    return unwrap(res).map(projectBooking);
  }
  return queryBookings(supabase, { patientId });
}

/** Staff/admin list: all, today, or unpaid-for-payment. */
export async function queryStaffBookings(
  supabase: SupabaseClient,
  scope: "all" | "today" | "for-payment" = "all",
): Promise<BookingRow[]> {
  if (resolveMode("bookings") === "dotnet") {
    const res = await api.get<{ items?: Raw[] }>(`/api/bookings/staff/${scope}`, { query: { pageSize: 500 } });
    return unwrap(res).map(projectBooking);
  }
  let q = supabase.from("bookings").select(SELECT);
  if (scope === "today") q = q.eq("appointment_date", new Date().toISOString().slice(0, 10));
  const { data } = await q.order("appointment_date", { ascending: false });
  let rows = (data ?? []).map((r) => projectBooking(r as Raw));
  if (scope === "for-payment") rows = rows.filter((b) => b.payments?.status === "Unpaid");
  return rows;
}

/** The logged-in doctor's bookings (all, or just today). */
export async function queryDoctorBookings(
  supabase: SupabaseClient,
  doctorId: string,
  opts: { today?: boolean } = {},
): Promise<BookingRow[]> {
  if (resolveMode("bookings") === "dotnet") {
    const path = opts.today ? "/api/bookings/doctor/today" : "/api/bookings";
    const rows = await api.get<Raw[]>(path, { query: opts.today ? undefined : { doctorId } });
    return rows.map(projectBooking);
  }
  const rows = await queryBookings(supabase, { doctorId });
  if (opts.today) {
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((b) => b.appointment_date === today);
  }
  return rows;
}

/**
 * Booking status transition (Phase 4c). .NET: PUT /api/bookings/{id}/status
 * `{ status, reason }`. `proofType`/`proofValue` (patient online-payment proof)
 * has no .NET endpoint yet — that path stays on Supabase (flagged, Phase 8).
 */
export async function updateBookingStatus(
  supabase: SupabaseClient,
  bookingId: string,
  status: string,
  opts: { reason?: string; proofType?: string; proofValue?: string } = {},
): Promise<void> {
  if (resolveMode("bookings") === "dotnet" && !opts.proofType) {
    await api.put(`/api/bookings/${bookingId}/status`, { status, reason: opts.reason ?? null });
    return;
  }
  const patch: Record<string, unknown> = { status };
  if (opts.reason) patch.cancellation_reason = opts.reason;
  if (opts.proofType) {
    patch.proof_type = opts.proofType;
    patch.proof_value = opts.proofValue;
  }
  await supabase.from("bookings").update(patch).eq("booking_id", bookingId);
}

export async function queryBookingById(supabase: SupabaseClient, bookingId: string): Promise<BookingRow | null> {
  if (resolveMode("bookings") === "dotnet") {
    try {
      return projectBooking(await api.get<Raw>(`/api/bookings/${bookingId}`));
    } catch {
      return null;
    }
  }
  const { data } = await supabase.from("bookings").select(SELECT).eq("booking_id", bookingId).maybeSingle();
  return data ? projectBooking(data as Raw) : null;
}
