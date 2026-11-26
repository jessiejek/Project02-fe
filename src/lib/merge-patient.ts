//JJQR - AI (2026-11-26) - GAV-12: "Merge to existing patient" rules, kept apart from the screen so they can be tested.
// Owner (t118u): jessie rubi had a consult on Nov 23; on Nov 25 the desk created a NEW record "jese rubi". The doctor remembers him and merges the
// current (newer) record INTO the existing one she picks. The picked record is kept; its own details win; only its blank fields are filled.
import { countsText, noteProblem, type MergeCounts } from "./sync-review.ts";

export interface ActiveVisit { booking_id: string; queue_number: string | null; status: string }

export interface MergeSide {
  patient_id: string; patient_code: string; first_name: string; middle_name: string | null; last_name: string;
  date_of_birth: string; sex: string; contact_number: string | null; email: string | null; address: string | null; city: string | null;
  civil_status?: string | null; blood_type?: string | null; philhealth_number?: string | null; hmo_provider?: string | null;
  has_account: boolean; created_at: string; counts: MergeCounts;
}

export interface MergeToExistingPreview {
  keep: MergeSide;
  merge: MergeSide;
  both_have_accounts: boolean;
  keep_active_today?: ActiveVisit[];
  merge_active_today?: ActiveVisit[];
}

export interface MergeResult {
  kept_patient_id: string; kept_patient_code?: string; merged_patient_id: string; merged_patient_code?: string;
  moved: MergeCounts; filled_fields: string[];
}

export interface MergedInto {
  patient_id: string; patient_code: string; merged_into_patient_id: string | null; merged_into_patient_code?: string | null; merged_into_name?: string | null;
}

const name = (c: { first_name: string; middle_name?: string | null; last_name: string }) => [c.first_name, c.middle_name, c.last_name].filter((p) => p && String(p).trim()).join(" ");

/** Why Confirm is not allowed yet (null = ready). */
export function mergeProblem(input: { currentPatientId: string; targetId: string | null; note: string; bothHaveAccounts?: boolean }): string | null {
  if (!input.targetId) return "Search and choose the existing patient first.";
  if (input.targetId === input.currentPatientId) return "That is this same record. Choose the other (older) record.";
  if (input.bothHaveAccounts) return "Both patients have a patient-portal account, so they cannot be merged here.";
  return noteProblem(input.note);
}

export function mergeBody(keepId: string, mergeId: string, note: string) {
  return { keep_patient_id: keepId, merge_patient_id: mergeId, note: note.trim() };
}

/** The warning shown (not a stop) when either record has a visit open today. */
export function activeVisitWarning(p: Pick<MergeToExistingPreview, "keep" | "merge" | "keep_active_today" | "merge_active_today">): string | null {
  const parts: string[] = [];
  const list = (v: ActiveVisit[] | undefined) => (v ?? []).map((x) => x.queue_number || x.status).join(", ");
  if ((p.merge_active_today?.length ?? 0) > 0) parts.push(`${name(p.merge)} has a visit open today (${list(p.merge_active_today)}); it moves to ${name(p.keep)} and this page reloads as ${name(p.keep)}.`);
  if ((p.keep_active_today?.length ?? 0) > 0) parts.push(`${name(p.keep)} also has a visit open today (${list(p.keep_active_today)}).`);
  return parts.length ? parts.join(" ") : null;
}

/** What the doctor reads above Confirm. */
export function mergeToExistingSummary(p: Pick<MergeToExistingPreview, "keep" | "merge">): string {
  const keep = `${name(p.keep)} (${p.keep.patient_code})`;
  const gone = `${name(p.merge)} (${p.merge.patient_code})`;
  const what = countsText(p.merge.counts);
  return `${gone} will be merged into ${keep}. ` + (what === "No records" ? "" : `Everything recorded for ${name(p.merge)} (${what}) moves to ${name(p.keep)}. `)
    + `${name(p.keep)}'s details stay as they are; only blank fields are filled from ${name(p.merge)}. ${gone} is then hidden from the lists (never deleted); an admin can unmerge it.`;
}

export function mergeDoneText(r: MergeResult, keepName: string, goneName: string): string {
  const moved = countsText(r.moved);
  return `${goneName}${r.merged_patient_code ? ` (${r.merged_patient_code})` : ""} is now merged into ${keepName}${r.kept_patient_code ? ` (${r.kept_patient_code})` : ""}.`
    + (moved === "No records" ? "" : ` Moved: ${moved}.`) + (r.filled_fields.length ? ` Filled blank fields: ${r.filled_fields.length}.` : "");
}

/** "Merged into MF-100001 (Jessie Rubi)" for the banner on a retired chart; null when the record is live. */
export function mergedBannerText(m: MergedInto | null | undefined): string | null {
  if (!m || !m.merged_into_patient_id) return null;
  return `This record (${m.patient_code}) was merged into ${m.merged_into_patient_code ?? "another record"}${m.merged_into_name ? ` (${m.merged_into_name})` : ""}. Use that chart instead.`;
}
//JJQR - END
