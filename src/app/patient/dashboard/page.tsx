"use client";

import { todayManila } from "@/lib/clock";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SkeletonCard, SkeletonStats } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatClinicDate, formatClockTime } from "@/lib/format";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctors } from "@/lib/data/doctors";
import { queryDoctorRatings } from "@/lib/data/admin";
import { queryConsultations, queryRxGroups } from "@/lib/data/clinical";
import { queryPatientById } from "@/lib/data/patients";
import { queryMyBookings } from "@/lib/data/bookings";
import { resendVerification } from "@/lib/auth/account";

interface BookingRow {
  id: string;
  doctorName: string;
  appointmentDate: string;
  slotStartTime: string;
  status: string;
  paymentStatus: string;
}

interface RecentItem {
  kind: "record" | "prescription";
  date: string;
  title: string;
  doctor: string;
}

interface DoctorCard {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  reviewCount: number;
  reviewsUnavailable: boolean;
}

// Stitch screen_2_patient_dashboard. Was reading a single hardcoded
// mockPatient regardless of who was signed in — fixed to scope everything
// to session.patientId, matching the pattern already used across the rest
// of the real-data patient pages.
export default function PatientDashboardPage() {
  const { session } = useSession();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [resending, setResending] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(true);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [prescriptionCount, setPrescriptionCount] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [bannerToast, setBannerToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;
    let cancelled = false;
    async function load() {
      try {
        const supabase = null as never;
        const [patientRow, bookingRows, rxRes, consultRes, doctorsRes, ratingsRes] = await Promise.all([
          queryPatientById(supabase, patientId),
          queryMyBookings(supabase, patientId),
          queryRxGroups(supabase, { patientId }),
          queryConsultations(supabase, { patientId }),
          queryDoctors(supabase),
          queryDoctorRatings(supabase).then((data) => ({ data, unavailable: false })).catch(() => ({ data: [] as Awaited<ReturnType<typeof queryDoctorRatings>>, unavailable: true })),
        ]);

        if (cancelled) return;
        if (!patientRow) throw new Error("Patient profile unavailable");
        setFirstName(patientRow.first_name);
        setPatientEmail(patientRow.email);
        setIsEmailVerified(patientRow.is_email_verified);
        setConsentedAt(patientRow.consented_at);

        const mappedBookings: BookingRow[] = bookingRows.map((b) => {
          const payment = b.payments;
          return {
            id: b.booking_id,
            doctorName: b.doctors?.staff_accounts?.full_name ?? "",
            appointmentDate: b.appointment_date,
            slotStartTime: b.slot_start_time.slice(0, 5),
            status: b.status,
            paymentStatus: payment?.status ?? "Unpaid",
          };
        });
        setBookings(mappedBookings);
        setPrescriptionCount(rxRes.length);

        const recordItems: RecentItem[] = consultRes.map((c) => {
          const date = c.bookings?.appointment_date ?? "";
          return { kind: "record" as const, date, title: c.chief_complaint ?? "", doctor: c.doctors?.staff_accounts?.full_name ?? "" };
        });
        const rxItems: RecentItem[] = rxRes.map((g) => {
          const staff = g.bookings?.doctors?.staff_accounts;
          const date = g.created_at.slice(0, 10);
          return {
            kind: "prescription" as const,
            date,
            title: (g.prescription_line_items ?? []).map((i) => i.generic_name).join(", "),
            doctor: staff?.full_name ?? "",
          };
        });
        setRecentItems([...recordItems, ...rxItems].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 2));

        const ratingByDoctor = new Map((ratingsRes.data ?? []).map((r) => [r.doctor_id, r]));
        setDoctors(
          doctorsRes
            .filter((d) => d.staff_accounts?.status !== "Inactive")
            .slice(0, 6)
            .map((d) => ({
              id: d.doctor_id,
              name: d.staff_accounts?.full_name ?? "",
              specialization: d.specialization,
              rating: ratingByDoctor.get(d.doctor_id)?.average_rating ?? 0,
              reviewCount: ratingByDoctor.get(d.doctor_id)?.review_count ?? 0,
              reviewsUnavailable: ratingsRes.unavailable,
            })),
        );

        setLoadError("");
        setLoaded(true);
      } catch {
        if (!cancelled) { setLoadError("Your dashboard could not be loaded. Please try again."); setLoaded(true); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session?.patientId, retryKey]);

  if (session && !session.patientId) return <AppShell role="patient"><ErrorState title="Patient profile unavailable" message="We could not find a patient profile for this session. Please reload or contact the clinic." onRetry={() => window.location.reload()} /></AppShell>;
  if (loadError) return <AppShell role="patient"><ErrorState title="Dashboard unavailable" message={loadError} onRetry={() => { setLoadError(""); setLoaded(false); setRetryKey(key => key + 1); }} /></AppShell>;

  if (!loaded) {
    return (
      <AppShell role="patient">
        <div className="space-y-xl" aria-busy="true">
          <p role="status" className="sr-only">Loading your dashboard…</p>
          <SkeletonCard lines={3} />
          <SkeletonStats count={4} />
        </div>
      </AppShell>
    );
  }

  const upcoming = bookings.filter((b) => ["Confirmed", "CheckedIn"].includes(b.status) && b.appointmentDate >= todayManila()).sort((a, b) => `${a.appointmentDate} ${a.slotStartTime}`.localeCompare(`${b.appointmentDate} ${b.slotStartTime}`));
  // Completed visits with an outstanding balance — "Pay at Clinic" is the
  // only payment mode now, so this means money owed, not a proof-of-payment
  // upload (that flow doesn't exist for walk-in visits).
  const paymentDue = bookings.filter((b) => b.status === "Completed" && b.paymentStatus === "Unpaid");
  const completed = bookings.filter((b) => b.status === "Completed" && b.paymentStatus === "Paid");
  const nextBooking = upcoming[0];

  async function handleResendVerification() {
    if (resending) return;
    if (!patientEmail) {
      setBannerToast({ variant: "error", message: "No email on file for this account." });
      return;
    }
    setResending(true);
    try {
      const accepted = await resendVerification(patientEmail);
      setBannerToast(accepted
        ? { variant: "success", message: "Verification requested. Check your inbox if your email needs verification." }
        : { variant: "error", message: "The verification request could not be sent. Please try again." });
    } finally { setResending(false); }
  }

  return (
    <AppShell role="patient">
      <div className="space-y-xl">
        <div className="space-y-sm">
          {bannerToast && (
            <Toast
              key={bannerToast.message}
              variant={bannerToast.variant}
              message={bannerToast.message}
              dismissible
            />
          )}
          {!isEmailVerified && (
            <Toast
              variant="warning"
              message="Please verify the email address used for clinic messages."
              actionLabel="Resend verification email"
              onAction={handleResendVerification}
              actionLoading={resending}
            />
          )}
          {!consentedAt && (
            <Toast
              variant="warning"
              message="Please review how the clinic uses your information."
              actionLabel="Review consent"
              actionHref="/patient/privacy-consent"
            />
          )}
        </div>

        <PageHeader
          title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          description="Your visits, what you owe, and your records from the clinic."
          actions={
            <Link href="/patient/bookings" className={buttonStyles("primary")}>
              <Icon name="add_circle" className="text-[16px]" />
              Book a visit
            </Link>
          }
        />

        {nextBooking ? (
          <section aria-labelledby="next-appointment" className="rounded-xl bg-primary p-lg text-on-primary shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-md">
              <div className="min-w-0 space-y-xs">
                <h2 id="next-appointment" className="text-label-md font-medium text-on-primary/80">Next Appointment</h2>
                <p className="text-balance text-headline-md">{formatClinicDate(nextBooking.appointmentDate)}</p>
                <p className="text-body-md tabular-nums text-on-primary/90">
                  {formatClockTime(nextBooking.slotStartTime)} · {nextBooking.doctorName || "Doctor to be confirmed"}
                </p>
              </div>
              <Link
                href={`/patient/bookings/${nextBooking.id}`}
                className={buttonStyles("secondary", "!border-transparent !bg-on-primary !text-primary hover:!bg-on-primary/90")}
              >
                View booking
              </Link>
            </div>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
            <div className="space-y-xs">
              <h2 className="text-headline-sm text-on-surface">No upcoming appointment</h2>
              <p className="text-body-md text-on-surface-variant">Pick a doctor and a day that works for you.</p>
            </div>
            <Link href="/patient/doctors" className={buttonStyles("secondary")}>Find a doctor</Link>
          </section>
        )}

        <section aria-label="Your numbers" className="grid grid-cols-2 gap-md lg:grid-cols-4">
          <StatCard icon="calendar_today" value={upcoming.length} label="Active Appointments" href="/patient/bookings" />
          <StatCard icon="receipt_long" value={paymentDue.length} label="Visits to pay for" href="/patient/bookings" />
          <StatCard icon="check_circle" value={completed.length} label="Completed visits" href="/patient/bookings" />
          <StatCard icon="medication" value={prescriptionCount} label="Prescriptions" href="/patient/prescriptions" />
        </section>

        <div className="grid grid-cols-1 gap-xl lg:grid-cols-2">
          <section className="space-y-md">
            <div className="flex items-center justify-between gap-md">
              <h2 className="text-headline-sm text-on-surface">Latest records</h2>
              <Link href="/patient/medical-records" className="text-label-md font-medium text-primary hover:underline">All records</Link>
            </div>
            {recentItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant p-lg text-body-md text-on-surface-variant">
                Records and prescriptions appear here after your first visit.
              </p>
            ) : (
              <ul className="space-y-sm">
                {recentItems.map((item, i) => (
                  <li key={i}>
                    <Link
                      href={item.kind === "record" ? "/patient/medical-records" : "/patient/prescriptions"}
                      className="flex items-center gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-primary"
                    >
                      <Icon name={item.kind === "record" ? "description" : "medication"} className="shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-label-md text-on-surface-variant">
                          {item.kind === "record" ? "Visit record" : "Prescription"} · <span className="tabular-nums">{formatClinicDate(item.date)}</span>
                        </span>
                        <span className="block truncate text-body-md font-medium text-on-surface">{item.title || "Details on file"}</span>
                        {item.doctor && <span className="block text-label-md text-on-surface-variant">{item.doctor}</span>}
                      </span>
                      <Icon name="chevron_right" className="shrink-0 text-[14px] text-on-surface-variant" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label="More records" className="flex flex-wrap gap-sm">
              <Link href="/patient/prescriptions" className={buttonStyles("ghost", "!px-md")}>Prescriptions</Link>
              <Link href="/patient/lab-results" className={buttonStyles("ghost", "!px-md")}>Lab results</Link>
              <Link href="/patient/documents" className={buttonStyles("ghost", "!px-md")}>Documents</Link>
            </nav>
          </section>

          <section className="space-y-md">
            <div className="flex items-center justify-between gap-md">
              <h2 className="text-headline-sm text-on-surface">Clinic doctors</h2>
              <Link href="/patient/doctors" className="text-label-md font-medium text-primary hover:underline">All doctors</Link>
            </div>
            {doctors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant p-lg text-body-md text-on-surface-variant">No doctors are listed yet.</p>
            ) : (
              <ul className="space-y-sm">
                {doctors.slice(0, 4).map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/patient/doctors/${doc.id}`}
                      className="flex items-center justify-between gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md transition-colors hover:border-primary"
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-body-md font-medium text-on-surface">{doc.name}</span>
                        <span className="block text-label-md text-on-surface-variant">{doc.specialization}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-xs text-label-md text-on-surface-variant">
                        {doc.reviewsUnavailable ? (
                          "Reviews unavailable"
                        ) : doc.reviewCount > 0 ? (
                          <>
                            <Icon name="star" className="text-[14px] text-tertiary" />
                            <span className="font-medium tabular-nums text-on-surface">{doc.rating}</span>
                            <span className="tabular-nums">({doc.reviewCount})</span>
                          </>
                        ) : (
                          "No reviews yet"
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {upcoming.length > 1 && (
          <section className="space-y-md">
            <h2 className="text-headline-sm text-on-surface">Also coming up</h2>
            <ul className="divide-y divide-outline-variant/40 rounded-xl border border-outline-variant bg-surface-container-lowest">
              {upcoming.slice(1, 4).map((b) => (
                <li key={b.id}>
                  <Link href={`/patient/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-sm px-lg py-md hover:bg-surface-container-low">
                    <span className="text-body-md tabular-nums text-on-surface">{formatClinicDate(b.appointmentDate)} · {formatClockTime(b.slotStartTime)}</span>
                    <span className="flex items-center gap-sm text-label-md text-on-surface-variant">{b.doctorName}<StatusPill status={b.status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
