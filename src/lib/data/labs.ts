/**
 * lab_orders (§16.8 Form 3) — INTEGRATION_ROADMAP.md Phase 8.5 tail.
 *
 * A consultation's lab request is a replace-all set keyed on consultation_id
 * (same shape as consultation_diagnoses). .NET-only — no Supabase equivalent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";

export interface LabOrderRow {
  lab_order_id?: string;
  consultation_id?: string;
  patient_id?: string;
  doctor_id?: string;
  lab_test_id: string | null;
  test_name: string;
  clinical_indication: string | null;
  specimen_type: string | null;
  notes: string | null;
  status?: string;
  requested_at?: string;
}

export interface LabOrderInput {
  lab_test_id: string | null;
  test_name: string;
  clinical_indication?: string | null;
  specimen_type?: string | null;
  notes?: string | null;
}

export async function queryLabOrdersByBooking(
  _supabase: SupabaseClient,
  bookingId: string,
): Promise<LabOrderRow[]> {
  try {
    return await api.get<LabOrderRow[]>(`/api/lab-orders/by-booking/${bookingId}`);
  } catch {
    return [];
  }
}

export async function queryLabOrdersByConsultation(
  _supabase: SupabaseClient,
  consultationId: string,
): Promise<LabOrderRow[]> {
  try {
    return await api.get<LabOrderRow[]>(`/api/lab-orders/by-consultation/${consultationId}`);
  } catch {
    return [];
  }
}

export async function replaceLabOrdersByConsultation(
  _supabase: SupabaseClient,
  consultationId: string,
  orders: LabOrderInput[],
): Promise<LabOrderRow[]> {
  return api.put<LabOrderRow[]>(`/api/lab-orders/by-consultation/${consultationId}`, orders);
}
