// Parity: GET /api/patients  vs  supabase.from("patients").select("*")
export const key = (r) => r.patient_id;
export async function supabase(sb) {
  const { data, error } = await sb.from("patients").select("*").order("last_name");
  if (error) throw error;
  return data ?? [];
}
export async function dotnet(api) {
  return api.get("/api/patients");
}
