//JJQR Nov 20, 2026
/** Default professional-fee tab when no saved Charge/Waive decision exists. */
export function initialPfDecision(
  fd: { type: "Charge" | "Waive" } | null | undefined,
): "charge" | "waive" {
  return fd?.type === "Waive" ? "waive" : "charge";
}

/** Follow-up section gate: dated needs a date; PRN and no follow-up are satisfied by mode alone. */
export function followUpModeSatisfied(
  mode: "dated" | "prn" | "none",
  followUpDate: string,
): boolean {
  if (mode === "dated") return followUpDate.trim() !== "";
  return true;
}
//JJQR - END

//JJQR - AI (Nov 20, 2026) - UX fix: a PRN follow-up is saved with TODAY's date (the API needs a date) so it must never be treated as "due today" or shown as a real date.
/** True when a saved follow-up is the "PRN / return if needed" kind (same test the consult page uses to reopen in PRN mode). */
export function isPrnFollowUp(
  f: { reason?: string | null; instructions?: string | null } | null | undefined,
): boolean {
  if (!f) return false;
  return /PRN/i.test(f.reason ?? "") || /PRN/i.test(f.instructions ?? "");
}

/** The read-only Follow-up line on a completed visit: no ISO dates, and PRN shows no date at all. */
export function followUpViewLine(
  f: {
    date?: string | null;
    reason?: string | null;
    instructions?: string | null;
    reminder?: boolean | null;
  } | null | undefined,
  formatDate: (iso: string) => string,
): string {
  if (!f || !f.date) return "No follow-up recorded.";
  if (isPrnFollowUp({ reason: f.reason, instructions: f.instructions })) {
    const text = (f.instructions ?? "").trim() || (f.reason ?? "").trim();
    return text || "PRN — return if needed";
  }
  const reason = (f.reason ?? "").trim();
  const instructions = (f.instructions ?? "").trim();
  return `${formatDate(f.date)}${reason ? ` — ${reason}` : ""}${instructions ? ` (${instructions})` : ""}${f.reminder ? " · reminder on" : ""}`;
}
//JJQR - END
