/**
 * §16.3 — manual walk-in FCFS queue (INTEGRATION_ROADMAP.md Phase 8.3).
 *
 * Replaces the appointment-slot model: one doctor, no slots, patients checked
 * in in arrival order with a per-day queue number. Each entry is still a
 * `bookings` row so payments / consultation / clinical records are unchanged.
 *
 * .NET-only — there is no Supabase equivalent for these routes.
 */
import { api } from "@/lib/api/client";

export interface QueueTicket {
  booking_id: string;
  queue_number: string;
  //JJQR - AI (Nov 21, 2026) - priority lane
  lane?: "R" | "S";
  is_priority?: boolean;
  //JJQR - END
  sequence: number;
  patient_name: string;
  patient_code: string;
  doctor_name: string;
  clinic_name: string;
  clinic_address: string;
  visit_type: "New" | "FollowUp";
  provisional_fee: number;
  issued_at: string;
}

export interface QueueEntry {
  booking_id: string;
  queue_number: string;
  is_priority?: boolean; //JJQR - AI (Nov 21, 2026) - priority lane
  patient_id: string;
  patient_name: string;
  patient_code: string;
  status: string;
  visit_type: "New" | "FollowUp";
  amount_due: number;
  checked_in_at: string;
  is_walk_in: boolean;
}

export interface QueueBoard {
  date: string;
  summary: {
    booked: number;
    waiting: number;
    in_progress: number;
    completed: number;
    no_show: number;
    total: number;
  };
  items: QueueEntry[];
}

export interface CheckInWalkIn {
  patient_id: string;
  visit_type?: "New" | "FollowUp" | null;
  med_cert_requested?: boolean | null;
  discount_category?: "Senior" | "PWD" | null;
  notes?: string | null;
}

export async function checkInWalkIn(_supabase: unknown, body: CheckInWalkIn): Promise<QueueTicket> {
  return api.post<QueueTicket>("/api/queue", body);
}

export async function queryQueue(_supabase: unknown, date?: string): Promise<QueueBoard> {
  return api.get<QueueBoard>("/api/queue", { query: date ? { date } : undefined });
}

type QueueAction = "check-in" | "call" | "hold" | "complete" | "no-show";

export async function updateQueueEntry(
  _supabase: unknown,
  bookingId: string,
  action: QueueAction,
): Promise<void> {
  await api.put(`/api/queue/${bookingId}/${action}`, {});
}

/** Staff cancels a not-yet-seen booking (Pending / CheckedIn / OnHold); a reason is required. */
export async function cancelQueueEntry(bookingId: string, reason: string): Promise<void> {
  await api.put(`/api/queue/${bookingId}/cancel`, { reason });
}

//JJQR - AI (2026-11-25) - why: GAV-4 "Not finished on an earlier day" — earlier-day Waiting / On hold / In consultation visits (the caller's own
// scope: a doctor's own, staff the clinic's) and "Move to today" (same booking, today's date, a new queue number; 409 if it already changed).
export interface LeftoverBoard {
  today: string;
  from: string;
  items: import("@/lib/leftover-queue").LeftoverEntry[];
}

export async function queryLeftovers(): Promise<LeftoverBoard> {
  return api.get<LeftoverBoard>("/api/queue/leftovers");
}

export interface MovedToToday {
  booking_id: string;
  appointment_date: string;
  queue_number: string;
  status: string;
  previous_date: string;
  previous_queue_number: string;
}

export async function moveLeftoverToToday(bookingId: string): Promise<MovedToToday> {
  return api.put<MovedToToday>(`/api/queue/${bookingId}/move-to-today`, {});
}
//JJQR - END
