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
