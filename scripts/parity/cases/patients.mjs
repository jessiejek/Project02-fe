// Parity: GET /api/patients  vs  supabase.from("patients").select("*")
export const key = (r) => r.patient_id;

// senior_id_number / pwd_id_number are .NET-only columns (§16.6 / Phase 8.4
// fee-line proof) — the old Supabase `patients` table never had them, so a
// select("*") diff on them is a forward-migration artifact, not a divergence.
export const volatileKeys = ["senior_id_number", "pwd_id_number"];

export async function supabase(sb) {
  const { data, error } = await sb.from("patients").select("*").order("last_name");
  if (error) throw error;
  return data ?? [];
}
export async function dotnet(api) {
  return api.get("/api/patients");
}
