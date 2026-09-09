// Parity: bookings + full §6 embeds, projected to the canonical shape.
export const key = (r) => r.booking_id;
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const SELECT = `*,
  patients(first_name, last_name, patient_code, contact_number, email, sex, date_of_birth),
  doctors(specialization, consultation_fee, slot_duration_minutes, staff_accounts(full_name)),
  booking_services(service_id, price_at_booking, services(name, price, category)),
  payments(status, waived_reason, or_number, amount, payment_method)`;
const num = (x) => (x == null ? null : Number(x));
const project = (raw) => {
  const p = one(raw.patients), pay = one(raw.payments), d = one(raw.doctors);
  const sa = d ? one(d.staff_accounts) : null;
  return {
    booking_id: String(raw.booking_id ?? ""),
    patient_id: String(raw.patient_id ?? ""),
    doctor_id: String(raw.doctor_id ?? ""),
    appointment_date: String(raw.appointment_date ?? ""),
    slot_start_time: String(raw.slot_start_time ?? ""),
    slot_end_time: String(raw.slot_end_time ?? ""),
    status: String(raw.status ?? ""),
    payment_mode: String(raw.payment_mode ?? ""),
    queue_number: raw.queue_number ?? null,
    consultation_fee_snapshot: Number(raw.consultation_fee_snapshot ?? 0),
    total_fee: Number(raw.total_fee ?? 0),
    amount_due: Number(raw.amount_due ?? 0),
    is_walk_in: Boolean(raw.is_walk_in),
    proof_type: raw.proof_type ?? null,
    proof_value: raw.proof_value ?? null,
    cancellation_reason: raw.cancellation_reason ?? null,
    notes: raw.notes ?? null,
    patients: p ? { first_name: p.first_name ?? null, last_name: p.last_name ?? null, patient_code: p.patient_code ?? null, contact_number: p.contact_number ?? null, email: p.email ?? null, sex: p.sex ?? null, date_of_birth: p.date_of_birth ?? null } : null,
    doctors: d ? { specialization: d.specialization ?? null, consultation_fee: num(d.consultation_fee), slot_duration_minutes: num(d.slot_duration_minutes), staff_accounts: sa ? { full_name: sa.full_name ?? null } : null } : null,
    booking_services: (raw.booking_services ?? []).map((r) => { const s = one(r.services); return { service_id: r.service_id, price_at_booking: num(r.price_at_booking), services: s ? { name: s.name ?? null, price: num(s.price), category: s.category ?? null } : null }; }),
    payments: pay ? { status: pay.status ?? null, waived_reason: pay.waived_reason ?? null, or_number: pay.or_number ?? null, amount: num(pay.amount), payment_method: pay.payment_method ?? null } : null,
  };
};
export async function supabase(sb) {
  const { data, error } = await sb.from("bookings").select(SELECT);
  if (error) throw error;
  return (data ?? []).map(project);
}
export async function dotnet(api) {
  return (await api.get("/api/bookings")).map(project);
}
