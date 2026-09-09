/** Shared session shape (safe to import from both client and server). */
export interface SessionInfo {
  userId: string;
  role: "Patient" | "Staff" | "Doctor" | "Admin";
  displayName: string;
  avatarUrl: string | null;
  /** staff_accounts.staff_id — also doctors.doctor_id 1:1 when role is Doctor. Only set for Staff/Doctor/Admin. */
  staffId: string | null;
  /** patients.patient_id. Only set for Patient. */
  patientId: string | null;
}
