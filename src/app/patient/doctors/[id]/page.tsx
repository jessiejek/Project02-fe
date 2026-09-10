import { todayManila } from "@/lib/clock";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryReviews } from "@/lib/data/patientFiles";
import { queryDoctorRatings } from "@/lib/data/admin";
import { queryDoctorSchedules, queryDayStatus } from "@/lib/data/scheduling";
import { indexToDayName } from "@/lib/days";

// Stitch screen_5_doctor_profile. Retiring mockDoctors per
// Implementation-Phases/05-doctors-staff.md.
export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayManila();

  const [doctor, schedule, ratingRes, dayStatusRow, reviewsRes] = await Promise.all([
    queryDoctorById(supabase, id),
    queryDoctorSchedules(supabase, id),
    queryDoctorRatings(supabase).then((rows) => ({ data: rows.find((r) => r.doctor_id === id) ?? null })),
    queryDayStatus(supabase, id, today),
    queryReviews(supabase, { doctorId: id }).then((data) => ({ data })),
  ]);
  const staff = doctor?.staff_accounts ?? null;
  if (!doctor || staff?.status === "Inactive") notFound();
  const doctorName = staff?.full_name ?? "";
  const dayStatus = dayStatusRow?.status ?? "Available";

  return (
    <AppShell role="patient">
      <div className="space-y-lg pb-24">
        <Card className="flex flex-col items-center gap-lg text-center sm:flex-row sm:text-left">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
            <Icon name="person" className="text-[40px] text-on-surface-variant" />
          </div>
          <div>
            <h1 className="text-headline-lg text-on-surface">{doctorName}</h1>
            <p className="text-body-lg text-on-surface-variant">{doctor.specialization}</p>
            <div className="mt-sm flex flex-wrap items-center justify-center gap-md sm:justify-start">
              <span className="text-label-md font-bold text-primary">₱{doctor.consultation_fee}</span>
              <span className="flex items-center gap-xs text-label-md">
                <Icon name="star" className="text-sm text-tertiary" />
                {ratingRes.data?.average_rating ?? 0} ({ratingRes.data?.review_count ?? 0} reviews)
              </span>
              <StatusPill status={dayStatus} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-sm text-headline-sm text-on-surface">About</h2>
          <p className="text-body-md text-on-surface-variant">{doctor.bio}</p>
        </Card>

        {/* Patient.md §4: "formatted schedule, today's day-status" — the
            weekly schedule was entirely missing from this page. */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Weekly Schedule</h2>
          <div className="flex flex-wrap gap-sm">
            {schedule.map((s) => (
              <div key={s.day_of_week} className="flex flex-col items-center gap-xs">
                <span
                  className={
                    s.is_active
                      ? "rounded-full bg-primary-container px-md py-xs text-label-sm text-on-primary-container"
                      : "rounded-full bg-surface-container-high px-md py-xs text-label-sm text-on-surface-variant/50"
                  }
                >
                  {indexToDayName(s.day_of_week)}
                </span>
                {s.is_active && <span className="text-label-sm text-on-surface-variant">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>}
              </div>
            ))}
          </div>
          <p className="mt-md text-label-md text-on-surface-variant">
            Today&apos;s status: <StatusPill status={dayStatus} />
          </p>
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Patient Reviews</h2>
          {(reviewsRes.data ?? []).length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No reviews yet.</p>
          ) : (
            <div className="space-y-md">
              {(reviewsRes.data ?? []).map((review) => (
                <div key={review.review_id} className="rounded-lg border border-outline-variant p-md">
                  <div className="mb-xs flex items-center gap-xs">
                    <Icon name="star" className="text-sm text-tertiary" />
                    <span className="text-label-md font-bold text-on-surface">{review.rating}/5</span>
                    <span className="text-label-sm text-on-surface-variant">{review.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-body-md text-on-surface-variant">{review.comment?.trim() || "No comment provided."}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
          The clinic is walk-in only — no appointment booking. Visit during clinic hours and check in at the front desk.
        </p>
      </div>
    </AppShell>
  );
}
