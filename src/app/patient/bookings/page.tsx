"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { one, serviceNames } from "@/lib/one";

const TABS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "forPayment", label: "For Payment" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

interface BookingRow {
  id: string;
  doctorName: string;
  serviceNames: string[];
  appointmentDate: string;
  slotStartTime: string;
  status: string;
  queueNumber: string | null;
  paymentStatus: string;
}

function matchesTab(booking: BookingRow, tab: string) {
  switch (tab) {
    case "upcoming":
      return ["Confirmed", "CheckedIn"].includes(booking.status);
    case "forPayment":
      return booking.status === "Completed" && booking.paymentStatus === "Unpaid";
    case "completed":
      return booking.status === "Completed" && ["Paid", "Waived"].includes(booking.paymentStatus);
    case "cancelled":
      return ["Cancelled", "NoShow", "Expired"].includes(booking.status);
    default:
      return true;
  }
}

// Stitch screen_13_my_bookings.
export default function MyBookingsPage() {
  const { session, loading } = useSession();
  const [tab, setTab] = useState("all");
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;

    async function loadBookings() {
      const supabase = createClient();
      const { data } = await supabase
        .from("bookings")
        .select("booking_id, appointment_date, slot_start_time, status, queue_number, doctors(staff_accounts(full_name)), booking_services(services(name)), payments(status)")
        .eq("patient_id", patientId)
        .order("appointment_date", { ascending: false })
        .order("slot_start_time", { ascending: false });

      const mapped: BookingRow[] = (data ?? []).map((b) => {
        const doctor = one(b.doctors);
        const staff = one(doctor?.staff_accounts);
        const payment = one(b.payments);
        return {
          id: b.booking_id,
          doctorName: staff?.full_name ?? "",
          serviceNames: serviceNames(b.booking_services),
          appointmentDate: b.appointment_date,
          slotStartTime: b.slot_start_time.slice(0, 5),
          status: b.status,
          queueNumber: b.queue_number,
          paymentStatus: payment?.status ?? "Unpaid",
        };
      });

      setBookings(mapped);
    }

    loadBookings();
  }, [session?.patientId]);

  if (loading || !session?.patientId) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading your bookings...</p>
      </AppShell>
    );
  }

  const rows = bookings.filter((b) => matchesTab(b, tab));

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">My Bookings</h2>
        <Tabs tabs={TABS} activeId={tab} onChange={setTab} />
        <DataTable
          columns={[
            { header: "Doctor", render: (r) => r.doctorName },
            { header: "Services", render: (r) => r.serviceNames.join(", ") },
            { header: "Date / Time", render: (r) => `${r.appointmentDate} · ${r.slotStartTime}` },
            { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
            { header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { header: "Payment", render: (r) => <StatusPill status={r.paymentStatus} /> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/patient/bookings/${r.id}`}
          emptyMessage="No bookings in this category."
          renderMobileCard={(r) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-medium text-on-surface">{r.doctorName}</p>
                <StatusPill status={r.status} />
              </div>
              <p className="text-label-md text-on-surface-variant">{r.serviceNames.join(", ")}</p>
              <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                <span>{r.appointmentDate} · {r.slotStartTime}</span>
                <StatusPill status={r.paymentStatus} />
              </div>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
