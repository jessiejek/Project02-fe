//JJQR - AI (Nov 19, 2026) - NEW: typed read of GET /api/doctor/performance (the doctor's own numbers, aggregated server-side; money is gross PHP).
import { api } from "@/lib/api/client";

export type PerformancePeriodName = "today" | "week" | "month";

export interface PerformanceStats {
  patients_seen: number;
  unique_patients: number;
  new_visits: number;
  follow_up_visits: number;
  first_time_patients: number;
  /** Money actually received (Paid payments). The headline number. */
  collected: number;
  /** Total fee of the visits (what was charged). */
  billed: number;
  waived: number;
  refunded: number;
  unpaid_total: number;
  rx_groups: number;
  med_certs: number;
  lab_orders: number;
  no_shows: number;
  cancellations: number;
  /** null until there are enough finished consults to be meaningful. */
  avg_consult_minutes: number | null;
  avg_consult_samples: number;
}

export interface PerformancePeriod {
  name: string;
  from: string;
  to: string;
}

export interface PerformanceDay {
  date: string;
  patients_seen: number;
  collected: number;
  billed: number;
}

export interface TopDiagnosis {
  icd10_code: string | null;
  label: string;
  count: number;
}

export interface UnpaidVisit {
  booking_id: string;
  patient_id: string;
  patient_name: string;
  appointment_date: string;
  amount_due: number;
}

export interface DueFollowUp {
  follow_up_id: string;
  patient_id: string;
  patient_name: string;
  follow_up_date: string;
  reason: string | null;
}

export interface DoctorPerformance {
  doctor_id: string;
  currency: string;
  week_starts_on: string;
  period: PerformancePeriod;
  previous_period: PerformancePeriod;
  current: PerformanceStats;
  previous: PerformanceStats;
  /** The last 14 clinic days, oldest first, zero-filled. */
  series: PerformanceDay[];
  top_diagnoses: TopDiagnosis[];
  unpaid: { count: number; total: number; items: UnpaidVisit[] };
  follow_ups_due: { count: number; items: DueFollowUp[] };
}

/** The doctor id comes from the login on the server — never pass one. */
export async function fetchDoctorPerformance(
  period: PerformancePeriodName,
  opts: { signal?: AbortSignal } = {},
): Promise<DoctorPerformance> {
  return api.get<DoctorPerformance>("/api/doctor/performance", { query: { period }, signal: opts.signal });
}
//JJQR - END
