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
