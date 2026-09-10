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
  patient_id: string;
  patient_name: string;
  patient_code: string;
  status: string;
  visit_type: "New" | "FollowUp";
  amount_due: number;
  checked_in_at: string;
}

export interface QueueBoard {
  date: string;
  summary: {
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

type QueueAction = "call" | "hold" | "complete" | "no-show";

export async function updateQueueEntry(
  _supabase: unknown,
  bookingId: string,
  action: QueueAction,
): Promise<void> {
  await api.put(`/api/queue/${bookingId}/${action}`, {});
}
