export const key = (r) => r.id;
export async function supabase(sb) {
  const { data, error } = await sb.from("follow_ups").select("*");
  if (error) throw error; return data ?? [];
}
export async function dotnet(api) { return api.get("/api/follow-ups"); }
