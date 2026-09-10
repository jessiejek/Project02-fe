import { AppShell } from "@/components/shell/AppShell";
import { todayManila } from "@/lib/clock";
import { queryDoctors } from "@/lib/data/doctors";
import { queryDoctorRatings } from "@/lib/data/admin";
import { queryDayStatuses } from "@/lib/data/scheduling";
import { DoctorsBrowseClient } from "./DoctorsBrowseClient";

// Stitch screen_4_browse_doctors. Retiring mockDoctors per
// Implementation-Phases/05-doctors-staff.md — real doctors only from here on.
export default async function BrowseDoctorsPage() {
  const supabase = null as never;
  const today = todayManila();
  const [allDoctors, ratingsRes, dayStatuses] = await Promise.all([
    queryDoctors(supabase),
    queryDoctorRatings(supabase).then((data) => ({ data })),
    queryDayStatuses(supabase, today),
  ]);
  const doctors = allDoctors.filter((d) => d.staff_accounts?.status !== "Inactive");
  const ratingByDoctor = new Map((ratingsRes.data ?? []).map((r) => [r.doctor_id, r]));
  const dayStatusByDoctor = new Map(dayStatuses.map((s) => [s.doctor_id, s.status]));

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
