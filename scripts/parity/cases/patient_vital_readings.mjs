export const key = (r) => r.id;
// §16.1 — .NET-only column (added Phase 8.1); Supabase never had it.
export const volatileKeys = ["recorded_by_user_id"];
export async function supabase(sb) {
  const { data, error } = await sb.from("patient_vital_readings").select("*");
  if (error) throw error; return data ?? [];
}
export async function dotnet(api) { return api.get("/api/vitals"); }
