//JJQR - AI (2026-11-25) - owner: "Consultation saved" said "Charge ₱500" (the booking fee loaded when the page opened) after the doctor switched to
// Follow-up visit and was charged ₱400. Order: the amount she saved > the amount the form showed when she completed > the booking's fee from the server.
// Plain module (no imports) so node:test can check it (saved-fee.test.mjs).
export function savedSummaryAmount(storedAmount: string, formAmount: string, bookingTotal: number | null | undefined): string {
  if (storedAmount.trim() !== "") return storedAmount;
  if (formAmount.trim() !== "") return formAmount;
  return bookingTotal ? String(bookingTotal) : "";
}
//JJQR - END
