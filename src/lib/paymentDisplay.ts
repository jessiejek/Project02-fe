/** The clinic collects the fee after the visit, so a booking that hasn't been completed owes
 *  nothing yet. Show the payment status only once it's billable, or if a payment already exists
 *  (paid / waived / refunded) — never "Unpaid" on a pending, in-queue, or cancelled booking. */
export function showPaymentStatus(status: string, paymentStatus: string): boolean {
  return status === "Completed" || paymentStatus !== "Unpaid";
}

export const isVoidBooking = (status: string) => ["Cancelled", "NoShow", "Expired"].includes(status);
