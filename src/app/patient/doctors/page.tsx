import { AppShell } from "@/components/shell/AppShell";
import { createClient } from "@/lib/supabase/server";
import { queryDoctors } from "@/lib/data/doctors";
import { DoctorsBrowseClient } from "./DoctorsBrowseClient";

// Stitch screen_4_browse_doctors. Retiring mockDoctors per
// Implementation-Phases/05-doctors-staff.md — real doctors only from here on.
export default async function BrowseDoctorsPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [allDoctors, ratingsRes, dayStatusRes] = await Promise.all([
    queryDoctors(supabase),
    supabase.from("v_doctor_ratings").select("*"),
    supabase.from("doctor_day_statuses").select("*").eq("status_date", today),
  ]);
  const doctors = allDoctors.filter((d) => d.staff_accounts?.status !== "Inactive");
  const ratingByDoctor = new Map((ratingsRes.data ?? []).map((r) => [r.doctor_id, r]));
  const dayStatusByDoctor = new Map((dayStatusRes.data ?? []).map((s) => [s.doctor_id, s.status]));

  const cards = doctors.map((doc) => {
    const rating = ratingByDoctor.get(doc.doctor_id);
    return {
      id: doc.doctor_id,
      name: doc.staff_accounts?.full_name ?? "",
      specialization: doc.specialization,
      rating: rating?.average_rating ?? 0,
      reviewCount: rating?.review_count ?? 0,
      dayStatus: dayStatusByDoctor.get(doc.doctor_id) ?? "Available",
    };
  });
  const specializations = [...new Set(cards.map((d) => d.specialization))].sort();

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Browse Doctors</h2>
        <DoctorsBrowseClient doctors={cards} specializations={specializations} />
      </div>
    </AppShell>
  );
}
