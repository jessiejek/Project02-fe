"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { queryMyBookings, createOnlineBooking, cancelMyBooking } from "@/lib/data/bookings";
import { ApiError } from "@/lib/api/client";

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
  appointmentDate: string;
  slotStartTime: string;
  status: string;
  queueNumber: string | null;
  paymentStatus: string;
}

function matchesTab(booking: BookingRow, tab: string) {
  switch (tab) {
    case "upcoming":
      return ["Pending", "Confirmed", "CheckedIn"].includes(booking.status);
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
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const [bookDate, setBookDate] = useState(todayStr);

  function project(rows: import("@/lib/data/bookings").BookingRow[]) {
    return rows.map((b) => ({
      id: b.booking_id,
      doctorName: b.doctors?.staff_accounts?.full_name ?? "",
      appointmentDate: b.appointment_date,
      slotStartTime: b.slot_start_time.slice(0, 5),
      status: b.status,
      queueNumber: b.queue_number,
      paymentStatus: b.payments?.status ?? "Unpaid",
    }));
  }

  async function loadBookings(patientId: string) {
    const supabase = null as never;
    try {
      const rows = await queryMyBookings(supabase, patientId);
      setBookings(project(rows));
    } finally {
      setBookingsLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.patientId) return;
    loadBookings(session.patientId);
  }, [session?.patientId]);

  async function handleCancel(id: string) {
    if (!session?.patientId) return;
    if (!window.confirm("Cancel this booking? You'll lose your place in the queue.")) return;
    setBookError("");
    setCancellingId(id);
    try {
      await cancelMyBooking(id);
      await loadBookings(session.patientId);
    } catch (err) {
      setBookError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? err.message) : "Could not cancel the booking. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleBookToday() {
    if (!session?.patientId) return;
    setBookError("");
    setBooking(true);
    try {
      await createOnlineBooking({ appointmentDate: bookDate });
      await loadBookings(session.patientId);
    } catch (err) {
      setBookError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? err.message) : "Could not join the queue. Please try again.");
    } finally {
      setBooking(false);
    }
  }

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
        <div className="flex items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">My Bookings</h2>
          <div className="flex items-center gap-sm">
            <input
              type="date"
              aria-label="Visit date"
              value={bookDate}
              min={todayStr}
              onChange={(e) => setBookDate(e.target.value || todayStr)}
              className="rounded-lg border border-outline-variant px-md py-sm text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button onClick={handleBookToday} loading={booking}>
              {booking ? "Booking…" : bookDate === todayStr ? "Join today's queue" : "Book this day"}
            </Button>
          </div>
        </div>
        {bookError && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{bookError}</p>}
        <Tabs tabs={TABS} activeId={tab} onChange={setTab} />
        <DataTable
          columns={[
            { header: "Doctor", render: (r) => r.doctorName },
            { header: "Date", render: (r) => r.appointmentDate },
            { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
            { header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { header: "Payment", render: (r) => <StatusPill status={r.paymentStatus} /> },
            {
              header: "",
              render: (r) =>
                r.status === "Pending" ? (
                  <Button variant="ghost" className="!px-sm !py-xs text-label-sm text-error" loading={cancellingId === r.id} onClick={(e) => { e.stopPropagation(); handleCancel(r.id); }}>
                    Cancel
                  </Button>
                ) : null,
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/patient/bookings/${r.id}`}
          loading={bookingsLoading}
          emptyMessage="No bookings in this category."
          renderMobileCard={(r) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-medium text-on-surface">{r.doctorName}</p>
                <StatusPill status={r.status} />
              </div>
              <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                <span>{r.appointmentDate}</span>
                <StatusPill status={r.paymentStatus} />
              </div>
              {r.status === "Pending" && (
                <Button variant="ghost" className="!px-sm !py-xs text-label-sm text-error" loading={cancellingId === r.id} onClick={(e) => { e.stopPropagation(); handleCancel(r.id); }}>
                  Cancel booking
                </Button>
              )}
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
