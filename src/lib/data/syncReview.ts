//JJQR - AI (Nov 22, 2026) - offline-mode plan step 4.5: calls for the admin "Sync review" page (backend: /api/sync/review-items and /api/patients/merge*). Admin only.
import { api } from "@/lib/api/client";
import type { MergeCounts } from "@/lib/sync-review";

export interface ReviewItem {
  id: string;
  kind: string;
  status: "open" | "resolved";
  title: string;
  details: Record<string, unknown> | null;
  patient_id: string | null;
  other_patient_id: string | null;
  aggregate: string | null;
  entity_id: string | null;
  other_entity_id: string | null;
  origin_node_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution: "merged" | "dismissed" | "fixed" | null;
  resolution_note: string | null;
}

export interface ReviewList {
  items: ReviewItem[];
  total: number;
  open_total: number;
  page: number;
  page_size: number;
}

export async function listReviewItems(opts: { status?: string; kind?: string; page?: number; pageSize?: number } = {}): Promise<ReviewList> {
  return api.get<ReviewList>("/api/sync/review-items", {
    query: { status: opts.status || undefined, kind: opts.kind || undefined, page: opts.page ?? 1, page_size: opts.pageSize ?? 25 },
  });
}

export async function resolveReviewItem(id: string, resolution: "dismissed" | "fixed", note: string): Promise<ReviewItem> {
  return api.post<ReviewItem>(`/api/sync/review-items/${id}/resolve`, { resolution, note: note.trim() });
}

export interface MergeCard {
  patient_id: string;
  patient_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: string;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  has_account: boolean;
  created_at: string;
  counts: MergeCounts;
}

export interface MergePreview {
  keep: MergeCard;
  merge: MergeCard;
  both_have_accounts: boolean;
}

export async function previewMerge(keepPatientId: string, mergePatientId: string): Promise<MergePreview> {
  return api.get<MergePreview>("/api/patients/merge-preview", { query: { keep: keepPatientId, merge: mergePatientId } });
}

export async function mergePatients(keepPatientId: string, mergePatientId: string, note: string): Promise<{ kept_patient_id: string; merged_patient_id: string; moved: MergeCounts; filled_fields: string[] }> {
  return api.post("/api/patients/merge", { keep_patient_id: keepPatientId, merge_patient_id: mergePatientId, note: note.trim() });
}
//JJQR - END
