export const key = (r) => r.consultation_id;
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const norm = (c) => {
  const b = one(c.bookings), d = one(c.doctors), sa = d ? one(d.staff_accounts) : null, f = one(c.follow_ups);
  return {
    consultation_id: c.consultation_id, booking_id: c.booking_id, patient_id: c.patient_id, doctor_id: c.doctor_id,
    status: c.status, chief_complaint: c.chief_complaint ?? null, assessment: c.assessment ?? null, plan: c.plan ?? null,
    bookings: b ? { appointment_date: b.appointment_date ?? null } : null,
    doctors: sa ? { staff_accounts: { full_name: sa.full_name ?? null } } : (d ? { staff_accounts: null } : null),
    consultation_diagnoses: (c.consultation_diagnoses ?? []).map((x) => ({ custom_description: x.custom_description ?? null, type: x.type })).sort((a,z)=>(a.custom_description||"").localeCompare(z.custom_description||"")),
    follow_ups: f ? { follow_up_date: f.follow_up_date ?? null, instructions: f.instructions ?? null } : null,
  };
};
export async function supabase(sb) {
  const { data, error } = await sb.from("consultations").select("*, bookings(appointment_date), doctors(staff_accounts(full_name)), consultation_diagnoses(custom_description, type), follow_ups(follow_up_date, instructions)");
  if (error) throw error; return (data ?? []).map(norm);
}
export async function dotnet(api) { return (await api.get("/api/consultations")).map(norm); }
