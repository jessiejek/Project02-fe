"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { VitalsEditor } from "@/components/doctor/VitalsEditor";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { visitDate } from "@/components/doctor/appointments/model";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useSession } from "@/components/providers/SessionProvider";
import { queryBookingById } from "@/lib/data/bookings";

interface BookingHeader {
  appointmentDate: string;
  patientId: string;
  patientName: string;
  patientCode: string | null;
}

function VitalsDetailWorkflow({ bookingId }: { bookingId: string }) {
  const { session, loading } = useSession();
  const [snapshot, setSnapshot] = useState<{ id: string; booking: BookingHeader | null } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!session?.staffId) return;
    const doctorId = session.staffId;
    let cancelled = false;
    async function load() {
      try {
        const b = await queryBookingById(null, bookingId);
        if (cancelled) return;
        const booking = b && b.doctor_id === doctorId ? {
          appointmentDate: b.appointment_date, patientId: b.patient_id,
          patientName: [b.patients?.first_name, b.patients?.last_name].filter(Boolean).join(" ") || "Patient name unavailable",
          patientCode: b.patients?.patient_code ?? null,
        } : null;
        setSnapshot({ id: bookingId, booking });
        setFailedId(null);
      } catch { if (!cancelled) setFailedId(bookingId); }
    }
    void load();
    return () => { cancelled = true; };
  }, [bookingId, session?.staffId, attempt]);

  if (!loading && !session?.staffId) notFound();
  if (failedId === bookingId) return <AppShell role="doctor"><ErrorState title="Appointment unavailable" message="The appointment could not be loaded. Please try again." onRetry={() => { setFailedId(null); setAttempt(n => n+1); }} /></AppShell>;
  if (loading || !snapshot || snapshot.id !== bookingId) return <AppShell role="doctor"><SkeletonCard lines={5} /></AppShell>;
  const booking = snapshot.booking;
  if (!booking) notFound();

  return <AppShell role="doctor">
    <div className="mx-auto max-w-doctor-heading space-y-lg">
      <Link href={`/doctor/consultation2/${bookingId}`} className="inline-flex min-h-11 items-center gap-xs text-label-md text-primary hover:underline"><Icon name="chevron_left" className="h-4 w-4" />Back to consultation</Link>
      <DoctorPageHeader title="Record vital signs" description={<>{booking.patientName}{booking.patientCode && <> · <span className="font-mono">{booking.patientCode}</span></>} · <span className="tabular-nums">{visitDate(booking.appointmentDate)}</span></>} />
      <VitalsEditor key={bookingId} bookingId={bookingId} patientId={booking.patientId} />
    </div>
  </AppShell>;
}
export default function VitalsDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  return <VitalsDetailWorkflow bookingId={bookingId} />;
}
