export const key = (r) => r.template_id;
const norm = (t) => ({
  template_id: t.template_id, doctor_id: t.doctor_id, title: t.title, is_system_template: t.is_system_template,
  items: (t.prescription_template_items ?? []).map((i) => ({
    medicine_id: i.medicine_id, generic_name: i.generic_name, dosage: i.dosage,
    quantity: i.quantity, instruction: i.instruction ?? null, is_controlled_substance: i.is_controlled_substance,
  })).sort((a,b)=>a.medicine_id.localeCompare(b.medicine_id)),
});
export async function supabase(sb) {
  const { data, error } = await sb.from("prescription_templates").select("*, prescription_template_items(*)");
  if (error) throw error; return (data ?? []).map(norm);
}
export async function dotnet(api) { return (await api.get("/api/prescription-templates")).map(norm); }
