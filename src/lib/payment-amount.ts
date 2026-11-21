// JJQR - AI (Nov 20, 2026) - B-03: one rule for "amount received" so a typo can never be recorded as a payment
export const MAX_AMOUNT_RECEIVED = 100_000;

export type AmountCheck = { ok: true; value: number } | { ok: false; error: string };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/**
 * Validates what the cashier typed in "Amount received (₱)".
 * Blank, not a number, zero/negative, or ANYTHING other than the exact amount due → an error message (nothing is sent).
 * //JJQR - AI (Nov 21, 2026) - exact: not less, and not more with change handed back; the amount is the one the doctor set. Mirrors PaymentsController.Confirm on the server.
 */
export function checkAmountReceived(raw: string, amountDue: number): AmountCheck {
  const text = raw.replace(/[₱,\s]/g, "");
  if (text === "") return { ok: false, error: "Enter the amount received." };
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Amount received must be a number, like 450 or 450.50." };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: "Amount received must be a number, like 450 or 450.50." };
  if (value <= 0) return { ok: false, error: "Amount received must be more than ₱0." };
  if (value !== amountDue) return { ok: false, error: `Amount must be exactly ${peso(amountDue)} — the amount the doctor set.` };
  return { ok: true, value };
}
// JJQR - END
