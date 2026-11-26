//JJQR - AI (2026-11-26) - GAV-12: calls for "Merge to existing patient" (doctor + admin), the retired-chart banner and the admin's Unmerge.
import { api } from "@/lib/api/client";
import type { MergeResult, MergeToExistingPreview, MergedInto } from "@/lib/merge-patient";
import { mergeBody } from "@/lib/merge-patient";

export function previewMergeToExisting(keepPatientId: string, mergePatientId: string): Promise<MergeToExistingPreview> {
  return api.get<MergeToExistingPreview>("/api/patients/merge-preview", { query: { keep: keepPatientId, merge: mergePatientId } });
}

export function mergeIntoExisting(keepPatientId: string, mergePatientId: string, note: string): Promise<MergeResult> {
  return api.post<MergeResult>("/api/patients/merge", mergeBody(keepPatientId, mergePatientId, note));
}

export function getMergedInto(patientId: string): Promise<MergedInto> {
  return api.get<MergedInto>(`/api/patients/${patientId}/merged-into`);
}

export function unmergePatient(patientId: string, note: string): Promise<{ patient_id: string; patient_code: string; was_merged_into: string; was_merged_into_code: string }> {
  return api.post(`/api/patients/${patientId}/unmerge`, { note: note.trim() });
}
//JJQR - END
