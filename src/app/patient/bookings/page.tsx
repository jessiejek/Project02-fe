"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { useSession } from "@/components/providers/SessionProvider";
import { queryMyBookings } from "@/lib/data/bookings";

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
      const supabase = null as never;
      const rows = await queryMyBookings(supabase, patientId);
      setBookings(
        rows.map((b) => ({
          id: b.booking_id,
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
          appointmentDate: b.appointment_date,
          slotStartTime: b.slot_start_time.slice(0, 5),
          status: b.status,
          queueNumber: b.queue_number,
          paymentStatus: b.payments?.status ?? "Unpaid",
        })),
      );
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
