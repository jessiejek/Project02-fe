export const key = (r) => r.template_id;
export async function supabase(sb) {
  const { data, error } = await sb.from("vital_field_templates").select("*").order("description");
  if (error) throw error; return data ?? [];
}
export async function dotnet(api) { return api.get("/api/vital-field-templates"); }
