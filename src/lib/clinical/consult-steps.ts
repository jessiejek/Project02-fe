//JJQR - AI (Nov 19, 2026) - consultation step indicators: an untouched required step shows an EMPTY circle; the warning only appears after the doctor tried to complete.
export type StepIndicator = "complete" | "warning" | "partial" | "empty";

export function stepIndicator(opts: { satisfied: boolean; required: boolean; hasDraft: boolean; attemptedComplete: boolean }): StepIndicator {
  if (opts.satisfied) return "complete";
  if (opts.required) return opts.attemptedComplete ? "warning" : "empty";
  return opts.hasDraft ? "partial" : "empty";
}

/** Next missing required section after `current` (wraps around); falls back to the first missing one. */
export function nextMissingSection(missing: readonly number[], current: number, order: readonly number[]): number | null {
  if (missing.length === 0) return null;
  const pos = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(pos + step + order.length) % order.length];
    if (missing.includes(candidate)) return candidate;
  }
  return missing[0];
}
//JJQR - END
//JJQR Nov 20, 2026 - Prev/Next buttons beside Save draft: pure neighbour lookup over the visible section order (no wrap)
/** Section before/after `current` in `order`, or null at the ends (or when `current` is not in `order`). */
export function adjacentSection(order: readonly number[], current: number, direction: "prev" | "next"): number | null {
  const pos = order.indexOf(current);
  if (pos === -1) return null;
  const target = pos + (direction === "next" ? 1 : -1);
  return target >= 0 && target < order.length ? order[target] : null;
}
//JJQR - END
