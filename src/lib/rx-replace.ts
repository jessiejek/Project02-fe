//JJQR - AI (2026-11-25) - owner: the server keeps ONE prescription per visit, and saving a new one for a visit (PUT /api/prescription-groups/by-booking)
// silently REPLACED the one already there. Ask first: "This visit already has a prescription. Replace it?"
// Plain module (no imports) so node:test can check it (rx-replace.test.mjs).
export const RX_REPLACE_QUESTION = "This visit already has a prescription. Replace it?";

/** True when saving would replace a prescription this form did not load or save itself (a visit's group with at least one medicine). */
export function needsRxReplaceConfirm(formOwnsGroup: boolean, visitGroups: { prescription_line_items?: unknown[] | null }[] | null | undefined): boolean {
  if (formOwnsGroup) return false;
  return (visitGroups ?? []).some((g) => (g.prescription_line_items ?? []).length > 0);
}
//JJQR - END
