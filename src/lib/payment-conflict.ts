//JJQR - AI (Nov 25, 2026) - owner ("just trap the 2nd transaction"): the server's 409 for a payment someone else just recorded
// (staff Record payment vs doctor Mark received, or two desks). Body: { error: "not_unpaid", message: "This visit is no longer unpaid (it was just recorded)." }.
// Structural check (no import), so it works on an ApiError and is easy to unit test.
export const NO_LONGER_UNPAID = "This visit is no longer unpaid (it was just recorded).";
export function isNoLongerUnpaid(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { status, body } = e as { status?: unknown; body?: unknown };
  return status === 409 && !!body && typeof body === "object" && (body as Record<string, unknown>).error === "not_unpaid";
}
//JJQR - END
