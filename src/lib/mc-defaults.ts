//JJQR Nov 20, 2026 - med cert "examined in" pre-filled from the doctor's letterhead (same values as LETTERHEAD in print-forms-html.ts)
export const MC_EXAMINED_AT_DEFAULT = "GRACE MEDICAL CLINIC, 3ML Quezon National Highway, Buaya, Lapu Lapu City";

/** True when the doctor typed something beyond the auto-filled defaults (clinic + today's dates). */
export function mcHasTypedContent(
  fields: { examinedAt: string; examFrom: string; examTo: string; others: string[] },
  today: string,
): boolean {
  if (fields.examinedAt.trim() !== "" && fields.examinedAt.trim() !== MC_EXAMINED_AT_DEFAULT) return true;
  if (fields.examFrom.trim() !== "" && fields.examFrom !== today) return true;
  if (fields.examTo.trim() !== "" && fields.examTo !== today) return true;
  return fields.others.some((v) => v.trim() !== "");
}
//JJQR - END
