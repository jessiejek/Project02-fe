import { todayManila } from "@/lib/clock";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryReviews } from "@/lib/data/patientFiles";
import { queryDoctorRatings } from "@/lib/data/admin";
import { queryDoctorSchedules, queryDayStatus } from "@/lib/data/scheduling";
import { indexToDayName } from "@/lib/days";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { formatClinicDate, formatClockTime } from "@/lib/format";

// Stitch screen_5_doctor_profile. Retiring mockDoctors per
// Implementation-Phases/05-doctors-staff.md.
export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = null as never;
  const today = todayManila();

  const [doctor, schedule, ratingRes, dayStatusRow, reviewsRes] = await Promise.all([
    queryDoctorById(supabase, id),
    queryDoctorSchedules(supabase, id),
    queryDoctorRatings(supabase).then((rows) => ({ data: rows.find((r) => r.doctor_id === id) ?? null })).catch(() => ({ data: null })),
    queryDayStatus(supabase, id, today),
    queryReviews(supabase, { doctorId: id }).then((data) => ({ data })),
  ]);
  const staff = doctor?.staff_accounts ?? null;
  if (!doctor || staff?.status === "Inactive") notFound();
  const doctorName = staff?.full_name ?? "";
  const dayStatus = dayStatusRow?.status ?? "Available";

  const rating = ratingRes.data;
  const reviews = reviewsRes.data ?? [];

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <Link href="/patient/doctors" className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />
          All doctors
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 space-y-xs">
            <h1 className="text-balance break-words text-headline-lg-mobile text-on-surface sm:text-headline-lg">{doctorName}</h1>
            <p className="text-body-lg text-on-surface-variant">{doctor.specialization}</p>
            {/* No per-doctor fee — the clinic runs one flat fee schedule
                (see admin settings), computed at walk-in check-in. */}
            <p className="flex items-center gap-xs text-label-md text-on-surface-variant">
              {rating && rating.review_count > 0 ? (
                <>
                  <Icon name="star" className="text-[14px] text-tertiary" />
                  <span className="font-medium tabular-nums text-on-surface">{rating.average_rating}</span>
                  <span className="tabular-nums">({rating.review_count} {rating.review_count === 1 ? "review" : "reviews"})</span>
                </>
              ) : (
                "No reviews yet"
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-sm">
            <StatusPill status={dayStatus} />
            <Link href="/patient/bookings" className={buttonStyles("primary")}>Book a visit</Link>
          </div>
        </header>

        {doctor.bio?.trim() && (
          <Card>
            <h2 className="mb-sm text-headline-sm text-on-surface">About</h2>
            <p className="whitespace-pre-line text-body-md text-on-surface">{doctor.bio}</p>
          </Card>
        )}

        {/* Patient.md §4: "formatted schedule, today's day-status". */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Weekly hours</h2>
          {schedule.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Hours not posted yet. Ask the front desk.</p>
          ) : (
            <dl className="divide-y divide-outline-variant/40">
              {schedule.map((s) => (
                <div key={s.day_of_week} className="flex items-center justify-between gap-md py-sm">
                  <dt className="text-body-md text-on-surface">{indexToDayName(s.day_of_week)}</dt>
                  <dd className={s.is_active ? "text-body-md tabular-nums text-on-surface" : "text-body-md text-on-surface-variant"}>
                    {s.is_active ? `${formatClockTime(s.start_time.slice(0, 5))}–${formatClockTime(s.end_time.slice(0, 5))}` : "Not working"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">What patients say</h2>
          {reviews.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {reviews.map((review) => (
                <li key={review.review_id} className="space-y-xs py-md first:pt-0 last:pb-0">
                  <p className="flex items-center gap-sm text-label-md text-on-surface-variant">
                    <span className="flex items-center gap-xs font-medium text-on-surface">
                      <Icon name="star" className="text-[14px] text-tertiary" />
                      <span className="tabular-nums">{review.rating}/5</span>
                    </span>
                    <span className="tabular-nums">{formatClinicDate(review.created_at.slice(0, 10))}</span>
                  </p>
                  <p className="text-body-md text-on-surface">{review.comment?.trim() || <span className="text-on-surface-variant">No comment.</span>}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-body-sm text-on-surface-variant">
          Book a visit from Your bookings to get a queue number, or walk in during clinic hours and check in at the front desk.
        </p>
      </div>
    </AppShell>
  );
}
