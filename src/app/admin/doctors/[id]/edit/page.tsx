import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { DoctorForm } from "@/components/admin/DoctorForm";
import { createClient } from "@/lib/supabase/server";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryDoctorServices } from "@/lib/data/doctorServices";
import { indexToDayName } from "@/lib/days";
import type { Doctor } from "@/data/types";

export default async function EditDoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [d, doctorServices, scheduleRes] = await Promise.all([
    queryDoctorById(supabase, id),
    queryDoctorServices(supabase, { doctorId: id }),
    supabase.from("doctor_schedules").select("*").eq("doctor_id", id).order("day_of_week"),
  ]);
  if (!d) notFound();
  const staff = d.staff_accounts;

  const doctor: Doctor = {
    id: d.doctor_id,
    name: staff?.full_name ?? "",
    specialization: d.specialization,
    consultationFee: Number(d.consultation_fee),
    bio: d.bio ?? "",
    rating: 0,
    reviewCount: 0,
    dayStatus: "Available",
    services: doctorServices.map((s) => ({
      id: s.service_id,
      name: s.services?.name ?? "",
      category: (s.services?.category ?? "Consultation") as Doctor["services"][number]["category"],
      price: Number(s.services?.price ?? 0),
      durationMinutes: s.duration_minutes,
    })),
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
