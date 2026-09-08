import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { DoctorForm } from "@/components/admin/DoctorForm";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/one";
import { indexToDayName } from "@/lib/days";
import type { Doctor } from "@/data/types";

export default async function EditDoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [doctorRes, servicesRes, scheduleRes] = await Promise.all([
    supabase.from("doctors").select("*, staff_accounts(full_name, email, status)").eq("doctor_id", id).single(),
    supabase.from("doctor_services").select("service_id, duration_minutes, services(name, category, price)").eq("doctor_id", id),
    supabase.from("doctor_schedules").select("*").eq("doctor_id", id).order("day_of_week"),
  ]);
  if (!doctorRes.data) notFound();
  const d = doctorRes.data;
  const staff = one(d.staff_accounts);

  const doctor: Doctor = {
    id: d.doctor_id,
    name: staff?.full_name ?? "",
    specialization: d.specialization,
    consultationFee: Number(d.consultation_fee),
    bio: d.bio ?? "",
    rating: 0,
    reviewCount: 0,
    dayStatus: "Available",
    services: (servicesRes.data ?? []).map((s) => {
      const service = one(s.services);
      return {
        id: s.service_id,
        name: service?.name ?? "",
        category: service?.category ?? "Consultation",
        price: Number(service?.price ?? 0),
        durationMinutes: s.duration_minutes,
      };
    }),
    schedule: (scheduleRes.data ?? []).map((s) => ({
      day: indexToDayName(s.day_of_week),
      isActive: s.is_active,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
    })),
    licenseNumber: d.license_number ?? undefined,
    ptrNumber: d.ptr_number ?? undefined,
    s2Number: d.s2_number ?? undefined,
    email: staff?.email ?? "",
    status: (staff?.status as Doctor["status"]) ?? "Active",
    slotDurationMinutes: d.slot_duration_minutes,
  };

  return (
    <AppShell role="admin">
      <DoctorForm mode="edit" doctor={doctor} />
    </AppShell>
  );
}
