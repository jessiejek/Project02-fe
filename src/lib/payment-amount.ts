// JJQR - AI (Nov 20, 2026) - B-03: one rule for "amount received" so a typo can never be recorded as a payment
export const MAX_AMOUNT_RECEIVED = 100_000;

export type AmountCheck = { ok: true; value: number } | { ok: false; error: string };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/**
 * Validates what the cashier typed in "Amount received (₱)".
 * Blank, not a number, zero/negative, below the fee or absurdly large → an error message (nothing is sent).
 * More than the fee is fine (cash, change is handed back). Mirrors PaymentsController.Confirm on the server.
 */
export function checkAmountReceived(raw: string, amountDue: number): AmountCheck {
  const text = raw.replace(/[₱,\s]/g, "");
  if (text === "") return { ok: false, error: "Enter the amount received." };
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Amount received must be a number, like 450 or 450.50." };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: "Amount received must be a number, like 450 or 450.50." };
  if (value <= 0) return { ok: false, error: "Amount received must be more than ₱0." };
  if (value < amountDue) return { ok: false, error: `Amount received is less than the ${peso(amountDue)} due.` };
  if (value > MAX_AMOUNT_RECEIVED) return { ok: false, error: `Amount received can't be more than ${peso(MAX_AMOUNT_RECEIVED)}.` };
  return { ok: true, value };
}
// JJQR - END
