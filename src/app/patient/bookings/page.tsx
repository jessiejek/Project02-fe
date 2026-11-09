"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSession } from "@/components/providers/SessionProvider";
import { queryMyBookings, createOnlineBooking, cancelMyBooking } from "@/lib/data/bookings";
import { ApiError } from "@/lib/api/client";
import { todayManila } from "@/lib/clock";
import { showPaymentStatus } from "@/lib/paymentDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatClinicDateShort } from "@/lib/format";

const TABS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "forPayment", label: "To pay" },
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
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [bookedNote, setBookedNote] = useState("");
  const todayStr = todayManila();
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
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setBookingsLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;
    queueMicrotask(() => { void loadBookings(patientId); });
  }, [session?.patientId]);

  function closeCancel() {
    if (cancelling) return;
    setCancelId(null);
    setCancelError("");
  }

  async function confirmCancel() {
    if (!session?.patientId || !cancelId) return;
    setCancelError("");
    setCancelling(true);
    try {
      await cancelMyBooking(cancelId);
      await loadBookings(session.patientId);
      setCancelId(null);
    } catch (err) {
      setCancelError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? err.message) : "Could not cancel the booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleBookToday() {
    if (!session?.patientId) return;
    setBookError("");
    setBookedNote("");
    setBooking(true);
    try {
      await createOnlineBooking({ appointmentDate: bookDate });
      setBookedNote(bookDate === todayStr ? "You’re in today’s queue. Your number is in the list below." : `You’re booked for ${formatClinicDate(bookDate)}.`);
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
        <div className="space-y-lg" aria-busy="true">
          <p role="status" className="sr-only">Loading your bookings…</p>
          <SkeletonTable rows={5} columns={5} />
        </div>
      </AppShell>
    );
  }

  const rows = bookings.filter((b) => matchesTab(b, tab));
  const tabs = TABS.map((t) => {
    const n = bookings.filter((b) => matchesTab(b, t.id)).length;
    return { ...t, label: bookingsLoading || t.id === "all" ? t.label : `${t.label} (${n})` };
  });
  const cancelTarget = bookings.find((x) => x.id === cancelId);
  const cancelButton = (r: BookingRow, label: string) => (
    <Button variant="ghost" className="!min-h-9 !px-sm !py-xs text-label-md text-error" onClick={(e) => { e.stopPropagation(); setCancelId(r.id); }}>
      {label}
    </Button>
  );

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <PageHeader title="Your bookings" description="Book a visit, check your queue number, and see what you’ve paid." />

        <Card>
          <form
            className="flex flex-wrap items-end gap-md"
            onSubmit={(e) => { e.preventDefault(); handleBookToday(); }}
          >
            <div className="min-w-0 flex-1 space-y-xs sm:max-w-[16rem]">
              <label htmlFor="bookDate" className={labelStyles}>Visit date</label>
              <input
                id="bookDate"
                type="date"
                value={bookDate}
                min={todayStr}
                onChange={(e) => setBookDate(e.target.value || todayStr)}
                className={inputStyles("tabular-nums")}
              />
            </div>
            <Button type="submit" loading={booking}>
              {booking ? "Booking…" : bookDate === todayStr ? "Join today’s queue" : "Book this day"}
            </Button>
            <p className={`${hintStyles} basis-full`}>First come, first served. You get a queue number when you book; pay at the clinic after your visit.</p>
          </form>
        </Card>
        {bookError && <FormAlert>{bookError}</FormAlert>}
        {bookedNote && <FormAlert tone="success">{bookedNote}</FormAlert>}

        {loadError ? (
          <ErrorState
            title="Your bookings didn’t load"
            message="Check your connection, then try again."
            retrying={bookingsLoading}
            onRetry={() => { setBookingsLoading(true); loadBookings(session.patientId!); }}
          />
        ) : (
          <>
            <Tabs tabs={tabs} activeId={tab} onChange={setTab} />
            <DataTable
              columns={[
                { header: "Visit date", render: (r) => <span className="font-medium tabular-nums text-on-surface">{formatClinicDateShort(r.appointmentDate)}</span> },
                { header: "Doctor", render: (r) => r.doctorName || "—" },
                { header: "Queue", align: "right", render: (r) => <span className="tabular-nums">{r.queueNumber ?? "—"}</span> },
                { header: "Status", render: (r) => <StatusPill status={r.status} /> },
                { header: "Payment", render: (r) => (showPaymentStatus(r.status, r.paymentStatus) ? <StatusPill status={r.paymentStatus} /> : <span className="text-on-surface-variant">—</span>) },
                { header: "", align: "right", render: (r) => (r.status === "Pending" ? cancelButton(r, "Cancel") : null) },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              rowHref={(r) => `/patient/bookings/${r.id}`}
              loading={bookingsLoading}
              emptyMessage={bookings.length === 0 ? "No bookings yet. Pick a date above to book your first visit." : "No bookings in this list."}
              renderMobileCard={(r) => (
                <div className="space-y-xs">
                  <div className="flex items-start justify-between gap-md">
                    <div className="min-w-0">
                      <p className="text-body-md font-medium tabular-nums text-on-surface">{formatClinicDateShort(r.appointmentDate)}</p>
                      <p className="text-label-md text-on-surface-variant">{r.doctorName || "—"}{r.queueNumber && <> · <span className="tabular-nums">{r.queueNumber}</span></>}</p>
                    </div>
                    <div className="flex flex-col items-end gap-xs">
                      <StatusPill status={r.status} />
                      {showPaymentStatus(r.status, r.paymentStatus) && <StatusPill status={r.paymentStatus} />}
                    </div>
                  </div>
                  {r.status === "Pending" && cancelButton(r, "Cancel booking")}
                </div>
              )}
            />
          </>
        )}
      </div>

      <Modal
        isOpen={cancelId !== null}
        onClose={closeCancel}
        title={cancelTarget ? `Cancel your ${formatClinicDateShort(cancelTarget.appointmentDate)} visit?` : "Cancel booking"}
        footer={
          <>
            <Button variant="secondary" onClick={closeCancel} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel booking"}
            </Button>
          </>
        }
      >
        <div className="space-y-sm text-body-md text-on-surface">
          {cancelError && <FormAlert>{cancelError}</FormAlert>}
          <p>
            {cancelTarget?.queueNumber ? <>You&apos;ll lose queue number <span className="font-medium tabular-nums">{cancelTarget.queueNumber}</span>.</> : <>You&apos;ll lose your place in the queue.</>}{" "}
            You can book again afterwards.
          </p>
        </div>
      </Modal>
    </AppShell>
  );
}
