// Parity: doctor_services + nested services(name, category, price)
export const key = (r) => `${r.doctor_id}:${r.service_id}`;
const project = (raw) => {
  const s = Array.isArray(raw.services) ? raw.services[0] : raw.services;
  return {
    doctor_id: String(raw.doctor_id ?? ""),
    service_id: String(raw.service_id ?? ""),
    duration_minutes: Number(raw.duration_minutes ?? 0),
    services: s ? { name: s.name ?? null, category: s.category ?? null, price: s.price == null ? null : Number(s.price) } : null,
  };
};
export async function supabase(sb) {
  const { data, error } = await sb.from("doctor_services").select("doctor_id, service_id, duration_minutes, services(name, category, price)");
  if (error) throw error;
  return (data ?? []).map(project);
}
export async function dotnet(api) {
  return (await api.get("/api/doctor-services")).map(project);
}
