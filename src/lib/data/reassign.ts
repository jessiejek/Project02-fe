//JJQR - AI (2026-11-26) - GAV-11: calls for the doctor's "Wrong patient?" dialog (backend BookingReassignController). Doctor (own visits) / Admin only.
import { api } from "@/lib/api/client";
import type { ReassignPreview, ReassignResult } from "@/lib/wrong-patient";

export function getReassignPreview(bookingId: string, targetPatientId?: string | null): Promise<ReassignPreview> {
  return api.get<ReassignPreview>(`/api/bookings/${bookingId}/reassign-preview`, { query: targetPatientId ? { target: targetPatientId } : undefined });
}

export function reassignVisit(bookingId: string, body: unknown): Promise<ReassignResult> {
  return api.post<ReassignResult>(`/api/bookings/${bookingId}/reassign-patient`, body);
}
//JJQR - END
