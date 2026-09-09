// Parity case: GET doctors + nested staff_accounts (contract §6).
// Supabase: doctors(*, staff_accounts(full_name, status))
// .NET:     GET /api/doctors

export const key = (r) => r.doctor_id;

export async function supabase(sb) {
  const { data, error } = await sb
    .from("doctors")
    .select("*, staff_accounts(full_name, status)");
  if (error) throw error;
  return data ?? [];
}

export async function dotnet(api) {
  return api.get("/api/doctors");
}
