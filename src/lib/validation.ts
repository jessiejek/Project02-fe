// JJQR - AI (Nov 20, 2026) - B-01: the same limits the API enforces, so the form can warn before sending
/** Digits with + ( ) - . and spaces; 7–20 characters, at least 7 digits. Empty is fine (field optional). */
export function phoneProblem(value: string, label = "Contact number"): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^[0-9+()\-.\s]{7,20}$/.test(v) || v.replace(/\D/g, "").length < 7) {
    return `${label} must be a phone number (digits, spaces, + - ( ) only).`;
  }
  return null;
}

export function lengthProblem(value: string, max: number, label: string): string | null {
  return value.trim().length > max ? `${label} is too long (max ${max} characters).` : null;
}

/** `YYYY-MM-DD` strictly after `today` (also `YYYY-MM-DD`). */
export function futureDateProblem(value: string, today: string, label = "Date of birth"): string | null {
  return value && value > today ? `${label} cannot be in the future.` : null;
}
// JJQR - END
