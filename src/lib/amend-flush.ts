//JJQR - AI (Nov 20, 2026) - pure helpers: whether embedded Rx/vitals need a silent flush
export function shouldFlush(current: unknown, baseline: unknown): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

/** Persist Rx only when the list changed; skip creating a brand-new empty group. */
export function shouldFlushPrescription(
  currentItems: unknown[],
  baselineItems: unknown[],
  hasExistingGroup: boolean,
): boolean {
  if (!hasExistingGroup && currentItems.length === 0) return false;
  return shouldFlush(currentItems, baselineItems);
}
//JJQR - END
