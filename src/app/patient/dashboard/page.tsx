"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
  subtitle: string;
}

interface DoctorCard {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  reviewCount: number;
}

// Stitch screen_2_patient_dashboard. Was reading a single hardcoded
// mockPatient regardless of who was signed in — fixed to scope everything
// to session.patientId, matching the pattern already used across the rest
// of the real-data patient pages.
export default function PatientDashboardPage() {
  const { session } = useSession();
  const [loaded, setLoaded] = useState(false);
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
    async function load() {
      const supabase = null as never;
      const [patientRow, bookingRows, rxRes, consultRes, doctorsRes, ratingsRes] = await Promise.all([
        queryPatientById(supabase, patientId),
        queryMyBookings(supabase, patientId),
        queryRxGroups(supabase, { patientId }),
        queryConsultations(supabase, { patientId }),
        queryDoctors(supabase),
        queryDoctorRatings(supabase).then((data) => ({ data })).catch(() => ({ data: [] as Awaited<ReturnType<typeof queryDoctorRatings>> })),
      ]);

      if (patientRow) {
        setFirstName(patientRow.first_name);
        setPatientEmail(patientRow.email);
        setIsEmailVerified(patientRow.is_email_verified);
        setConsentedAt(patientRow.consented_at);
      }

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
        return { kind: "record" as const, date, title: c.chief_complaint ?? "", subtitle: `${c.doctors?.staff_accounts?.full_name ?? ""} • ${date}` };
      });
      const rxItems: RecentItem[] = rxRes.map((g) => {
        const staff = g.bookings?.doctors?.staff_accounts;
        const date = g.created_at.slice(0, 10);
        return {
          kind: "prescription" as const,
          date,
          title: (g.prescription_line_items ?? []).map((i) => i.generic_name).join(", "),
          subtitle: `${staff?.full_name ?? ""} • ${date}`,
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
          })),
      );

      setLoaded(true);
    }
    load();
  }, [session?.patientId]);

  if (!loaded) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading your dashboard…</p>
      </AppShell>
    );
  }

  const upcoming = bookings.filter((b) => ["Confirmed", "CheckedIn"].includes(b.status));
  // Completed visits with an outstanding balance — "Pay at Clinic" is the
  // only payment mode now, so this means money owed, not a proof-of-payment
  // upload (that flow doesn't exist for walk-in visits).
  const paymentDue = bookings.filter((b) => b.status === "Completed" && b.paymentStatus === "Unpaid");
  const completed = bookings.filter((b) => b.status === "Completed" && b.paymentStatus === "Paid");
  const nextBooking = upcoming[0];

  async function handleResendVerification() {
    if (!patientEmail) {
      setBannerToast({ variant: "error", message: "No email on file for this account." });
      return;
    }
    await resendVerification(patientEmail);
    setBannerToast({ variant: "success", message: "Verification email sent. Check your inbox." });
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
              message="Please verify your email address to ensure full access to your medical records."
              actionLabel="Resend Verification Email"
              onAction={handleResendVerification}
            />
          )}
          {!consentedAt && (
            <Toast
              variant="warning"
              message="Your privacy consent needs review to comply with updated healthcare regulations."
              actionLabel="Review Now"
              actionHref="/patient/privacy-consent"
            />
          )}
        </div>

        <div>
          <h2 className="text-headline-lg text-on-surface">Welcome back, {firstName}</h2>
          <p className="text-body-lg text-on-surface-variant">
            Here is an overview of your health status and upcoming tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-lg md:grid-cols-4">
          <StatCard icon="calendar_today" value={upcoming.length} label="Active Visits" eyebrow="Today" href="/patient/bookings" />
          <StatCard icon="receipt_long" value={paymentDue.length} label="Payment Due" eyebrow="Pending" href="/patient/bookings" />
          <StatCard icon="check_circle" value={completed.length} label="Completed Visits" eyebrow="History" href="/patient/bookings" />
          <StatCard icon="medication" value={prescriptionCount} label="Current Prescriptions" eyebrow="Active" href="/patient/prescriptions" />
        </div>

        <div className="hide-scrollbar overflow-x-auto pb-sm">
          <h3 className="mb-md text-headline-sm text-on-surface">Quick Actions</h3>
          <div className="flex min-w-max gap-md">
            <Link href="/patient/doctors">
              <Button>
                <Icon name="medical_services" className="text-[20px]" />
                Find a Doctor
              </Button>
            </Link>
            <Link href="/patient/bookings">
              <Button variant="secondary">
                <Icon name="calendar_month" className="text-[20px]" />
                My Bookings
              </Button>
            </Link>
            <Link href="/patient/privacy-consent">
              <Button variant="secondary">
                <Icon name="gavel" className="text-[20px]" />
                Review Consent
              </Button>
            </Link>
            <Link href="/patient/medical-records">
              <Button variant="secondary">
                <Icon name="folder_shared" className="text-[20px]" />
                Medical Records
              </Button>
            </Link>
            <Link href="/patient/prescriptions">
              <Button variant="secondary">
                <Icon name="prescriptions" className="text-[20px]" />
                Prescriptions
              </Button>
            </Link>
            <Link href="/patient/documents">
              <Button variant="secondary">
                <Icon name="description" className="text-[20px]" />
                My Documents
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-lg lg:grid-cols-12">
          <div className="space-y-lg lg:col-span-8">
            <section>
              <div className="mb-md flex items-center justify-between">
                <h3 className="text-headline-sm text-on-surface">Available Specialists</h3>
                <Link href="/patient/doctors" className="text-label-md text-primary hover:underline">
                  View All
                </Link>
              </div>
              <div className="flex gap-lg overflow-x-auto pb-md">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex min-w-[240px] flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-md text-center sm:min-w-[280px]"
                  >
                    <div className="mb-md flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary-fixed bg-surface-container-high">
                      <Icon name="person" className="text-[32px] text-on-surface-variant" />
                    </div>
                    <h4 className="text-headline-sm text-on-surface">{doc.name}</h4>
                    <p className="mb-md text-label-md text-on-surface-variant">{doc.specialization}</p>
                    <div className="mb-lg flex items-center gap-xs">
                      <Icon name="star" className="text-sm text-tertiary" />
                      <span className="text-label-sm font-bold">{doc.rating}</span>
                      <span className="text-label-sm text-on-surface-variant">({doc.reviewCount} reviews)</span>
                    </div>
                    <Link href={`/patient/doctors/${doc.id}`} className="w-full">
                      <Button variant="secondary" className="w-full">
                        Profile
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-md text-headline-sm text-on-surface">Recent Medical Records &amp; Prescriptions</h3>
              <div className="space-y-sm">
                {recentItems.length === 0 && (
                  <p className="text-body-md text-on-surface-variant">No records yet.</p>
                )}
                {recentItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
                    <div className="flex items-center gap-md">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                        <Icon name={item.kind === "record" ? "analytics" : "medication"} />
                      </div>
                      <div>
                        <h5 className="text-headline-sm text-on-surface">{item.title}</h5>
                        <p className="text-label-md text-on-surface-variant">{item.subtitle}</p>
                      </div>
                    </div>
                    <button type="button" className="rounded-lg p-xs text-on-surface-variant transition-all hover:bg-surface-container-high">
                      <Icon name="download" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-lg lg:col-span-4">
            {nextBooking && (
              <div className="relative overflow-hidden rounded-xl bg-primary p-lg text-on-primary shadow-lg">
                <h3 className="mb-md text-label-sm uppercase tracking-widest opacity-80">Your Visit Today</h3>
                <h4 className="text-headline-md">{nextBooking.doctorName}</h4>
                <div className="mb-lg flex items-center justify-between rounded-lg bg-on-primary/10 p-md">
                  <div className="flex items-center gap-sm">
                    <Icon name="calendar_today" />
                    <span className="text-label-md">{nextBooking.appointmentDate}</span>
                  </div>
                  <div className="flex items-center gap-sm">
                    <Icon name="schedule" />
                    <span className="text-label-md">{nextBooking.slotStartTime}</span>
                  </div>
                </div>
                <Link href={`/patient/bookings/${nextBooking.id}`}>
                  <Button variant="secondary" className="w-full !bg-on-primary !text-primary">
                    View Booking
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
