//JJQR - AI (Nov 22, 2026) - offline-mode plan step 4.5: the "Sync review" page. Plain rules (labels, what an admin may do, the merge wording) kept apart from the screen so they can be tested.

export type ReviewKind = "possible_duplicate_patient" | "or_number_clash" | "change_rejected" | "change_stuck";
export type ReviewStatus = "open" | "resolved";

export const REVIEW_KINDS: ReviewKind[] = ["possible_duplicate_patient", "or_number_clash", "change_rejected", "change_stuck"];

const LABEL: Record<ReviewKind, string> = {
  possible_duplicate_patient: "Possible duplicate patient",
  or_number_clash: "Receipt number used twice",
  change_rejected: "Change refused by the server",
  change_stuck: "Change stuck on a computer",
};

const HELP: Record<ReviewKind, string> = {
  possible_duplicate_patient: "A patient arrived from a computer with the same first name, last name and birthdate as someone already on file. Nothing was merged. Compare the two and merge only if they are the same person.",
  or_number_clash: "Two payments carry the same receipt number. Both were kept as printed. Check the receipt booklet, then mark this resolved.",
  change_rejected: "A clinic computer sent a change that the server could not accept. The work is still on that computer. Check it there, redo it on the web if needed, then mark this resolved.",
  change_stuck: "A clinic computer has tried to send a change many times without success. Check that computer, then mark this resolved.",
};

export function kindLabel(kind: string): string {
  return (LABEL as Record<string, string>)[kind] ?? kind;
}

export function kindHelp(kind: string): string {
  return (HELP as Record<string, string>)[kind] ?? "";
}

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

export function kindTone(kind: string): PillTone {
  switch (kind) {
    case "possible_duplicate_patient": return "warning";
    case "or_number_clash": return "danger";
    case "change_rejected": return "danger";
    case "change_stuck": return "warning";
    default: return "neutral";
  }
}

/** A duplicate is closed by merging (or dismissed); every other kind is closed with a note. */
export function isDuplicate(kind: string): boolean {
  return kind === "possible_duplicate_patient";
}

export const NOTE_MIN = 5;
export const NOTE_MAX = 1000;

export function noteProblem(note: string): string | null {
  const t = note.trim();
  if (t.length < NOTE_MIN) return `Write a note of at least ${NOTE_MIN} characters.`;
  if (t.length > NOTE_MAX) return `The note is too long (${NOTE_MAX} characters at most).`;
  return null;
}

export type MergeCounts = Record<string, number>;

// [singular, plural] for each kind of record a patient can hold
const COUNT_LABEL: Record<string, [string, string]> = {
  bookings: ["visit", "visits"], consultations: ["consultation", "consultations"], medical_certificates: ["medical certificate", "medical certificates"],
  vitals: ["vitals reading", "vitals readings"], follow_ups: ["follow-up", "follow-ups"], lab_orders: ["lab order", "lab orders"], lab_values: ["lab value", "lab values"],
  lab_results: ["lab result", "lab results"], documents: ["document", "documents"], vaccinations: ["vaccination", "vaccinations"],
  prescriptions: ["prescription", "prescriptions"], consents: ["consent", "consents"], data_requests: ["data request", "data requests"],
  reviews: ["review", "reviews"], allergies: ["allergy", "allergies"],
};

/** "3 visits, 1 consultation, 2 allergies" for what a patient holds (nothing at all: "No records"). */
export function countsText(counts: MergeCounts | null | undefined): string {
  const parts = Object.entries(counts ?? {})
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const [one, many] = COUNT_LABEL[key] ?? [key.replace(/_/g, " "), key.replace(/_/g, " ")];
      return `${n} ${n === 1 ? one : many}`;
    });
  return parts.length > 0 ? parts.join(", ") : "No records";
}

export function totalRecords(counts: MergeCounts | null | undefined): number {
  return Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
}

/** What the admin is told before confirming. */
export function mergeSummary(keepName: string, keepCode: string, mergeName: string, mergeCode: string, mergeCounts: MergeCounts): string {
  const moved = totalRecords(mergeCounts) > 0 ? `Everything recorded for ${mergeName} (${mergeCode}) — ${countsText(mergeCounts)} — will move to ${keepName} (${keepCode}). ` : `${mergeName} (${mergeCode}) has no records to move. `;
  return `${moved}${keepName}'s own details stay as they are; only fields that are empty on ${keepName} are filled from ${mergeName}. ${mergeName} is then marked as merged and disappears from the lists. This cannot be undone from this page.`;
}

export interface CardLike {
  first_name: string; middle_name: string | null; last_name: string;
}

export function fullName(c: CardLike): string {
  return [c.first_name, c.middle_name, c.last_name].filter((p) => p && p.trim()).join(" ");
}

export type FieldRow = { label: string; a: string; b: string; differs: boolean };

const dash = (v: unknown): string => (v === null || v === undefined || String(v).trim() === "" ? "—" : String(v));

/** The two records side by side, one row per field; `differs` marks the rows to look at. */
export function compareRows(a: Record<string, unknown>, b: Record<string, unknown>): FieldRow[] {
  const fields: [string, string][] = [
    ["Patient code", "patient_code"], ["First name", "first_name"], ["Middle name", "middle_name"], ["Last name", "last_name"],
    ["Birthdate", "date_of_birth"], ["Sex", "sex"], ["Contact number", "contact_number"], ["Email", "email"], ["Address", "address"], ["City", "city"],
  ];
  return fields.map(([label, key]) => {
    const x = dash(a[key]); const y = dash(b[key]);
    return { label, a: x, b: y, differs: x.toLowerCase() !== y.toLowerCase() };
  });
}

/** The message to show for a failed call (the server's own sentence when it sent one). */
export function problemMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string") return (body as { message: string }).message;
  return fallback;
}
//JJQR - END
