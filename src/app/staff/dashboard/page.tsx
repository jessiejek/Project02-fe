"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { formatClockTime } from "@/lib/format";
import { queryStaffBookings, updateBookingStatus } from "@/lib/data/bookings";
import { queryQueue, type QueueBoard } from "@/lib/data/queue";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

interface QueueRow {
  id: string;
  patientName: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
  paymentStatus: string;
}

// Stitch staff_dashboard. Reads a real query scoped to today's date,
// matching the pattern already used by doctor/dashboard.
const EMPTY_BOARD: QueueBoard = { date: "", summary: { booked: 0, waiting: 0, in_progress: 0, completed: 0, no_show: 0, total: 0 }, items: [] };

export default function StaffDashboardPage() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [bookings, setBookings] = useState<QueueRow[]>([]);
  const [board, setBoard] = useState<QueueBoard>(EMPTY_BOARD);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const loadBookings = useCallback(async () => {
    const data = await queryStaffBookings(null as never, "today");
    setBookings(
      data.map((b) => ({
        id: b.booking_id,
        patientName: b.patients ? `${b.patients.first_name ?? ""} ${b.patients.last_name ?? ""}`.trim() : "",
        slotStartTime: b.slot_start_time.slice(0, 5),
        queueNumber: b.queue_number,
        status: b.status,
        paymentStatus: b.payments?.status ?? "Unpaid",
      })),
    );
  }, []);

  // "Ready for payment" reads the walk-in queue board, not the separate
  // staff/today bookings list above — the two have disagreed on a booking's
  // status before (a booking marked Completed in the queue that the bookings
  // list still showed as something else), which meant a patient who'd
  // already been seen never showed up here for staff to collect from. The
  // queue board is the same source the Staff Queue page and the doctor's own
  // dashboard already trust, so this keeps one definition of "done" instead
  // of two that can drift apart.
  const loadQueue = useCallback(async () => {
    try {
      setBoard(await queryQueue(null as never));
    } catch {
      setBoard(EMPTY_BOARD);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadBookings(), loadQueue()]);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, [loadBookings, loadQueue]);

  useEffect(() => {
    queueMicrotask(() => { void loadAll(); });
  }, [loadAll]);

  useClinicHubEvent("PatientCheckedIn", () => { loadBookings().catch(() => {}); });
  useClinicHubEvent("QueueUpdated", () => {
    loadBookings().catch(() => {});
    loadQueue();
  });
  useClinicHubEvent("PaymentUpdated", loadQueue);

  // Fallback poll for a dropped/blocked SignalR connection (same pattern as
  // /staff/queue) — self-corrects within a minute if push doesn't arrive.
  useEffect(() => {
    const t = setInterval(() => {
      loadBookings().catch(() => {});
      loadQueue();
    }, 60_000);
    return () => clearInterval(t);
  }, [loadBookings, loadQueue]);

  const todaysQueue = bookings.filter((b) => ["Confirmed", "CheckedIn"].includes(b.status));
  const readyForPayment = board.items.filter((e) => e.status === "Completed" && Number(e.amount_due) > 0);
  // Staff sees headcount, not money — revenue belongs on the doctor's own
  // dashboard, not the front desk's.
  const totalPatientsToday = bookings.length;

  async function toggleCheckIn(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "Confirmed" ? "CheckedIn" : "Confirmed";
    setPendingId(id);
    setActionError("");
    try {
      await updateBookingStatus(null as never, id, nextStatus);
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: nextStatus } : b)));
    } catch {
      setActionError("Could not update the check-in. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function retry() {
    setRetrying(true);
    await loadAll();
    setRetrying(false);
  }

  const checkInLabel = (status: string) => (status === "Confirmed" ? "Check in" : "Undo check-in");

  return (
    <AppShell role="staff">
      <div className="space-y-xl">
        <PageHeader
          title="Front desk today"
          description="Who is booked, who has arrived, and who is waiting to pay."
          actions={
            <Link href="/staff/walk-in" className={buttonStyles("primary")}>
              <Icon name="directions_walk" className="text-[18px]" />
              New walk-in
            </Link>
          }
        />

        {!loaded ? (
          <div className="space-y-lg" aria-busy="true">
            <SkeletonStats count={3} />
            <SkeletonTable rows={4} columns={5} />
          </div>
        ) : loadError ? (
          <ErrorState title="Today’s list didn’t load" message="Check the connection to the clinic server, then try again." onRetry={retry} retrying={retrying} />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-lg md:grid-cols-3" aria-label="Today at a glance">
              <StatCard icon="event_note" value={todaysQueue.length} label="Booked or checked in" href="/staff/queue" />
              <StatCard icon="payments" value={readyForPayment.length} label="Ready for payment" href="/staff/payments" />
              <StatCard icon="groups" value={totalPatientsToday} label="Patients on today’s list" href="/staff/queue" />
            </section>

            {readyForPayment.length > 0 && (
              <Toast
                variant="warning"
                message={`${readyForPayment.length} ${readyForPayment.length === 1 ? "patient is" : "patients are"} ready to pay.`}
                actionLabel="Go to payments"
                actionHref="/staff/payments"
              />
            )}

            <nav aria-label="Front desk shortcuts" className="flex flex-wrap gap-sm">
              <Link href="/staff/payments" className={buttonStyles("secondary")}>Payments</Link>
              <Link href="/staff/doctor-status" className={buttonStyles("secondary")}>Doctor status</Link>
              <Link href="/staff/patients" className={buttonStyles("secondary")}>Patients</Link>
            </nav>

            <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant px-lg py-md">
                <h2 className="text-headline-sm text-on-surface">Arrivals</h2>
                <Link href="/staff/queue" className="text-label-md font-medium text-primary hover:underline">Open queue board</Link>
              </div>
              {actionError && <div className="px-lg pt-md"><FormAlert>{actionError}</FormAlert></div>}
              {todaysQueue.length === 0 ? (
                <p className="px-lg py-xl text-center text-body-md text-on-surface-variant">No one is booked or waiting right now.</p>
              ) : (
                <>
                  <ul className="divide-y divide-outline-variant/30 sm:hidden">
                    {todaysQueue.map((b) => (
                      <li key={b.id} className="space-y-sm p-lg">
                        <div className="flex items-start justify-between gap-md">
                          <div className="min-w-0">
                            <p className="break-words text-body-md font-medium text-on-surface">{b.patientName || "—"}</p>
                            <p className="text-label-sm tabular-nums text-on-surface-variant">
                              {formatClockTime(b.slotStartTime)} · Queue {b.queueNumber ?? "—"}
                            </p>
                          </div>
                          <StatusPill status={b.status} />
                        </div>
                        <Button variant="secondary" className="w-full" loading={pendingId === b.id} onClick={() => toggleCheckIn(b.id, b.status)}>
                          {checkInLabel(b.status)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                          <th className="px-lg py-sm font-medium">Patient</th>
                          <th className="px-lg py-sm font-medium">Time</th>
                          <th className="px-lg py-sm text-right font-medium">Queue</th>
                          <th className="px-lg py-sm font-medium">Status</th>
                          <th className="px-lg py-sm"><span className="sr-only">Action</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30 text-body-md text-on-surface">
                        {todaysQueue.map((b) => (
                          <tr key={b.id} className="hover:bg-surface-container-low">
                            <td className="px-lg py-md font-medium">{b.patientName || "—"}</td>
                            <td className="px-lg py-md tabular-nums">{formatClockTime(b.slotStartTime)}</td>
                            <td className="px-lg py-md text-right tabular-nums">{b.queueNumber ?? "—"}</td>
                            <td className="px-lg py-md"><StatusPill status={b.status} /></td>
                            <td className="px-lg py-md text-right">
                              <Button variant="secondary" loading={pendingId === b.id} onClick={() => toggleCheckIn(b.id, b.status)}>
                                {checkInLabel(b.status)}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
