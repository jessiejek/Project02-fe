// Parity case: the doctor directory as src/lib/data/doctors.ts exposes it.
// Both backends are projected to the canonical contract shape (§4/§6) — the
// same projection queryDoctors() applies — then deep-diffed.

export const key = (r) => r.doctor_id;

const STAFF = "full_name, status, email, avatar_url";

const project = (raw) => {
  const sa = raw.staff_accounts;
  const s = Array.isArray(sa) ? sa[0] : sa;
  return {
    doctor_id: String(raw.doctor_id ?? ""),
    specialization: String(raw.specialization ?? ""),
    consultation_fee: Number(raw.consultation_fee ?? 0),
    bio: raw.bio ?? null,
    license_number: raw.license_number ?? null,
    ptr_number: raw.ptr_number ?? null,
    s2_number: raw.s2_number ?? null,
    slot_duration_minutes: Number(raw.slot_duration_minutes ?? 30),
    slot_capacity: Number(raw.slot_capacity ?? 1),
    daily_patient_limit: raw.daily_patient_limit == null ? null : Number(raw.daily_patient_limit),
    staff_accounts: s
      ? {
          full_name: s.full_name ?? null,
          status: s.status ?? null,
          email: s.email ?? null,
          avatar_url: s.avatar_url ?? null,
        }
      : null,
  };
};

export async function supabase(sb) {
  const { data, error } = await sb.from("doctors").select(`*, staff_accounts(${STAFF})`);
  if (error) throw error;
  return (data ?? []).map(project);
}

export async function dotnet(api) {
  const rows = await api.get("/api/doctors");
  return rows.map(project);
}
