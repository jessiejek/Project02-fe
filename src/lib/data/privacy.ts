// JJQR - AI (Nov 20, 2026) - PV-12/13/14: consent decisions, own-data download, correction/deletion requests (BE: PrivacyController)
import { api } from "@/lib/api/client";

export type ConsentDecision = "Accepted" | "Declined" | "Withdrawn";

export interface ConsentHistoryRow { consent_version: number; decision: ConsentDecision; decided_at: string }
export interface MyConsentState { consented_at: string | null; consent_version: number; consent_withdrawn_at: string | null }

export async function decideConsent(patientId: string, decision: ConsentDecision) {
  return api.post<{ decision: ConsentDecision; consent_version: number; decided_at: string }>(`/api/patients/${patientId}/consent-decision`, { decision });
}

export async function queryConsentHistory(patientId: string): Promise<ConsentHistoryRow[]> {
  return api.get<ConsentHistoryRow[]>(`/api/patients/${patientId}/consents`);
}

export async function queryMyConsentState(): Promise<MyConsentState> {
  return api.get<MyConsentState>("/api/patients/me");
}

/** Everything the clinic holds about the patient, as a JSON file the browser saves. Nothing is cached or kept in the page afterwards. */
export async function downloadMyData(patientId: string): Promise<void> {
  const data = await api.get<unknown>(`/api/patients/${patientId}/export`);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-clinic-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type DataRequestKind = "Correction" | "Deletion";
export type DataRequestStatus = "Pending" | "Scheduled" | "Completed" | "Rejected";

export interface DataRequestRow {
  id: string;
  patient_id: string;
  kind: DataRequestKind;
  details: string;
  status: DataRequestStatus;
  requested_at: string;
  retain_until: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  // admin list only
  patient_name?: string;
  patient_code?: string;
}

export const createDataRequest = (kind: DataRequestKind, details: string) =>
  api.post<DataRequestRow>("/api/privacy/data-requests", { kind, details });
export const queryMyDataRequests = () => api.get<DataRequestRow[]>("/api/privacy/data-requests/mine");
export const queryAllDataRequests = (status?: string) => api.get<DataRequestRow[]>("/api/privacy/data-requests", { query: { status } });
export const resolveDataRequest = (id: string, status: DataRequestStatus, note?: string) =>
  api.put<DataRequestRow>(`/api/privacy/data-requests/${id}`, { status, note });
// JJQR - END
