"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { VitalsEditor } from "@/components/doctor/VitalsEditor";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { queryBookingById } from "@/lib/data/bookings";

interface BookingHeader {
  appointmentDate: string;
  serviceNames: string[];
  patientId: string;
}

function VitalsDetailWorkflow({ bookingId }: { bookingId: string }) {
  const { session, loading } = useSession();
  const [booking, setBooking] = useState<BookingHeader | null | undefined>(undefined);

  useEffect(() => {
    if (!session?.staffId) return;
    const doctorId = session.staffId;
    async function load() {
      const supabase = createClient();
      const b = await queryBookingById(supabase, bookingId);
      if (!b || b.doctor_id !== doctorId) {
        setBooking(null);
        return;
      }
      setBooking({
        appointmentDate: b.appointment_date,
        serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
        patientId: b.patient_id,
      });
    }
    load();
  }, [bookingId, session?.staffId]);

  if (loading) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading vitals...</p>
      </AppShell>
    );
  }

  if (!session?.staffId) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading vitals...</p>
      </AppShell>
    );
  }

  if (booking === null) notFound();

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <div>
          <Link
            href={`/doctor/consultation/${bookingId}`}
            className="mb-xs flex items-center gap-xs text-label-md text-primary hover:underline"
          >
            <Icon name="chevron_left" className="text-[16px]" />
            Back to Consultation
          </Link>
          <h1 className="text-headline-md text-on-surface">Vital Signs — {booking.serviceNames.join(", ")}</h1>
          <p className="text-label-md text-on-surface-variant">{booking.appointmentDate}</p>
        </div>

        <VitalsEditor bookingId={bookingId} patientId={booking.patientId} />
      </div>
    </AppShell>
  );
}

export default function VitalsDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  return <VitalsDetailWorkflow bookingId={bookingId} />;
}
