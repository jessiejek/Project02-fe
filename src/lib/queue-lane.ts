//JJQR - AI (Nov 21, 2026) - priority lane: queue numbers are R-001 (regular) / S-001 (senior citizen or PWD). S is always served ahead of R,
// first-come-first-served inside each lane. Pre-lane numbers ("Q-052") count as regular. Mirrors Project02-be ClinicApp.Domain.QueueLane.
// No imports on purpose: the plain Node test runner loads this file directly.

const collator = new Intl.Collator("en", { numeric: true });

/** True for a senior / PWD queue number such as "S-003". */
export function isPriorityQueueNumber(queueNumber: string | null | undefined): boolean {
  return typeof queueNumber === "string" && queueNumber.startsWith("S-");
}

/** Sort order for queue numbers: every S- ahead of every R-/Q-, then natural number order inside the lane (R-2 before R-10). */
export function compareQueueNumbers(a: string | null | undefined, b: string | null | undefined): number {
  const pa = isPriorityQueueNumber(a) ? 0 : 1;
  const pb = isPriorityQueueNumber(b) ? 0 : 1;
  if (pa !== pb) return pa - pb;
  return collator.compare(a ?? "", b ?? "");
}

/** Short label for the lane chip, or null for the regular lane. */
export function queueLaneLabel(queueNumber: string | null | undefined): string | null {
  return isPriorityQueueNumber(queueNumber) ? "Priority · Senior/PWD" : null;
}
//JJQR - END
