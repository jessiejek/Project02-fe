/**
 * Payment actions (INTEGRATION_ROADMAP.md Phase 4d).
 *
 * The FE keys everything by booking_id; the .NET endpoints key by payment_id
 * (POST /api/payments/{paymentId}/confirm|waive|refund), so dotnet mode resolves
 * payment_id via GET /api/payments/booking/{bookingId} first.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/client";
import { resolveMode } from "./mode";

const dotnet = () => resolveMode("payments") === "dotnet";

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
  supabase: SupabaseClient,
  bookingId: string,
  input: ConfirmPaymentInput,
): Promise<void> {
  if (dotnet()) {
    const id = await paymentIdForBooking(bookingId);
    await api.post(`/api/payments/${id}/confirm`, {
      payment_method: input.paymentMethod,
      amount_received: input.amountReceived,
      reference_number: input.referenceNumber ?? null,
      or_number: input.orNumber ?? null,
      confirm_notes: input.confirmNotes ?? null,
    });
    return;
  }
  await supabase
    .from("payments")
    .update({
      status: "Paid",
      payment_method: input.paymentMethod,
      amount_received: input.amountReceived,
      reference_number: input.referenceNumber?.trim() || null,
      confirm_notes: input.confirmNotes?.trim() || null,
      confirmed_at: new Date().toISOString(),
      ...(input.orNumber ? { or_number: input.orNumber } : {}),
    })
    .eq("booking_id", bookingId);
}

export async function waivePayment(
  supabase: SupabaseClient,
  bookingId: string,
  reason: string,
): Promise<void> {
  if (dotnet()) {
    const id = await paymentIdForBooking(bookingId);
    await api.post(`/api/payments/${id}/waive`, { reason });
    return;
  }
  await supabase
    .from("payments")
    .update({ status: "Waived", waived_reason: reason, waived_at: new Date().toISOString() })
    .eq("booking_id", bookingId);
}

export async function refundPayment(
  supabase: SupabaseClient,
  bookingId: string,
  input: { amount: number; reason: string },
): Promise<void> {
  if (dotnet()) {
    const id = await paymentIdForBooking(bookingId);
    await api.post(`/api/payments/${id}/refund`, { amount: input.amount, reason: input.reason });
    return;
  }
  await supabase
    .from("payments")
    .update({
      status: "Refunded",
      refund_amount: input.amount,
      refund_reason: input.reason,
      refunded_at: new Date().toISOString(),
    })
    .eq("booking_id", bookingId);
}
