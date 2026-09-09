export const key = (r) => r.consultation_id;
export async function supabase(sb) {
  const { data, error } = await sb.from("consultations").select("*");
  if (error) throw error; return data ?? [];
}
export async function dotnet(api) { return api.get("/api/consultations"); }
