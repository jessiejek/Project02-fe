/**
 * Payment actions (INTEGRATION_ROADMAP.md Phase 4d).
 *
 * The FE keys everything by booking_id; the .NET endpoints key by payment_id
 * (POST /api/payments/{paymentId}/confirm|waive|refund), so we resolve
 * payment_id via GET /api/payments/booking/{bookingId} first.
 *
 * The leading `_supabase` parameter is a migration vestige (callers pass
 * `null as never`).
 */
import { api } from "@/lib/api/client";

async function paymentIdForBooking(bookingId: string): Promise<string> {
  const p = await api.get<{ payment_id: string }>(`/api/payments/booking/${bookingId}`);
  return p.payment_id;
}

export interface ConfirmPaymentInput {
  paymentMethod: string;
  amountReceived: number;
  referenceNumber?: string | null;
  orNumber?: string | null;
  confirmNotes?: string | null;
}

export async function confirmPayment(
  _supabase: unknown,
  bookingId: string,
  input: ConfirmPaymentInput,
): Promise<void> {
  const id = await paymentIdForBooking(bookingId);
  await api.post(`/api/payments/${id}/confirm`, {
    payment_method: input.paymentMethod,
    amount_received: input.amountReceived,
    reference_number: input.referenceNumber ?? null,
    or_number: input.orNumber ?? null,
    confirm_notes: input.confirmNotes ?? null,
  });
}

export async function waivePayment(
  _supabase: unknown,
  bookingId: string,
  reason: string,
): Promise<void> {
  const id = await paymentIdForBooking(bookingId);
  await api.post(`/api/payments/${id}/waive`, { reason });
}

export async function refundPayment(
  _supabase: unknown,
  bookingId: string,
  input: { amount: number; reason: string },
): Promise<void> {
  const id = await paymentIdForBooking(bookingId);
  await api.post(`/api/payments/${id}/refund`, { amount: input.amount, reason: input.reason });
}
