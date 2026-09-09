// Parity: GET /api/staff-accounts  vs  supabase.from("staff_accounts").select("*")
export const key = (r) => r.staff_id;
export async function supabase(sb) {
  const { data, error } = await sb.from("staff_accounts").select("*").order("full_name");
  if (error) throw error;
  return data ?? [];
}
export async function dotnet(api) {
  return api.get("/api/staff-accounts");
}
