import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryDoctorServices } from "@/lib/data/doctorServices";
import { queryReviews } from "@/lib/data/patientFiles";
import { queryDoctorRatings } from "@/lib/data/admin";
import { indexToDayName } from "@/lib/days";

// Stitch screen_5_doctor_profile. Retiring mockDoctors per
// Implementation-Phases/05-doctors-staff.md.
export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [doctor, doctorServices, scheduleRes, ratingRes, dayStatusRes, reviewsRes] = await Promise.all([
    queryDoctorById(supabase, id),
    queryDoctorServices(supabase, { doctorId: id }),
    supabase.from("doctor_schedules").select("*").eq("doctor_id", id).order("day_of_week"),
    queryDoctorRatings(supabase).then((rows) => ({ data: rows.find((r) => r.doctor_id === id) ?? null })),
    supabase.from("doctor_day_statuses").select("status").eq("doctor_id", id).eq("status_date", today).maybeSingle(),
    queryReviews(supabase, { doctorId: id }).then((data) => ({ data })),
  ]);
  const staff = doctor?.staff_accounts ?? null;
  if (!doctor || staff?.status === "Inactive") notFound();
  const doctorName = staff?.full_name ?? "";
  const dayStatus = dayStatusRes.data?.status ?? "Available";

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

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Services</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant text-left text-label-md text-on-surface-variant">
                  <th className="py-sm">Service</th>
                  <th className="py-sm">Category</th>
                  <th className="py-sm">Price</th>
                  <th className="py-sm">Duration</th>
                </tr>
              </thead>
              <tbody>
                {doctorServices.map((s) => (
                  <tr key={s.service_id} className="border-b border-outline-variant/40">
                    <td className="py-sm text-body-md">{s.services?.name}</td>
                    <td className="py-sm text-body-md text-on-surface-variant">{s.services?.category}</td>
                    <td className="py-sm text-body-md">₱{s.services?.price}</td>
                    <td className="py-sm text-body-md">{s.duration_minutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Patient.md §4: "formatted schedule, today's day-status" — the
            weekly schedule was entirely missing from this page. */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Weekly Schedule</h2>
          <div className="flex flex-wrap gap-sm">
            {(scheduleRes.data ?? []).map((s) => (
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

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant bg-surface-container-lowest p-md md:left-sidebar">
          <div className="mx-auto max-w-content">
            <Link href={`/booking?doctorId=${doctor.doctor_id}`}>
              <Button className="w-full">Book with {doctorName}</Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
