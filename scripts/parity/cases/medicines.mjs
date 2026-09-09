export const key = (r) => r.medicine_id;
export async function supabase(sb) {
  const { data, error } = await sb.from("medicines").select("*").order("generic_name");
  if (error) throw error; return data ?? [];
}
export async function dotnet(api) { return api.get("/api/medicines"); }
