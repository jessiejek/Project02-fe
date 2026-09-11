"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { queryStaffBookings, updateBookingStatus } from "@/lib/data/bookings";

interface QueueRow {
  id: string;
  patientName: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
  paymentStatus: string;
}

// Stitch staff_dashboard. Was reading mockBookings regardless of what's
// actually scheduled today — fixed to a real query scoped to today's date,
// matching the pattern already used by doctor/dashboard.
export default function StaffDashboardPage() {
  const [loaded, setLoaded] = useState(false);
  const [bookings, setBookings] = useState<QueueRow[]>([]);

  useEffect(() => {
    async function load() {
      const data = await queryStaffBookings(null as never, "today");
      const rows: QueueRow[] = data.map((b) => ({
        id: b.booking_id,
        patientName: b.patients ? `${b.patients.first_name ?? ""} ${b.patients.last_name ?? ""}`.trim() : "",
        slotStartTime: b.slot_start_time.slice(0, 5),
        queueNumber: b.queue_number,
        status: b.status,
        paymentStatus: b.payments?.status ?? "Unpaid",
      }));
      setBookings(rows);
      setLoaded(true);
    }
    load();
  }, []);

  const todaysQueue = bookings.filter((b) => ["Confirmed", "CheckedIn"].includes(b.status));
  const readyForPayment = bookings.filter((b) => b.status === "Completed" && b.paymentStatus === "Unpaid");
  // Staff sees headcount, not money — revenue belongs on the doctor's own
  // dashboard, not the front desk's.
  const totalPatientsToday = bookings.length;

  async function toggleCheckIn(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "Confirmed" ? "CheckedIn" : "Confirmed";
    const supabase = null as never;
    await updateBookingStatus(supabase, id, nextStatus);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: nextStatus } : b)));
  }

  if (!loaded) {
    return (
      <AppShell role="staff">
        <p className="text-body-md text-on-surface-variant">Loading dashboard…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="staff">
      <div className="space-y-xl">
        <h2 className="text-headline-lg text-on-surface">Staff Dashboard</h2>

        <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
          <StatCard icon="event_note" value={todaysQueue.length} label="Today's Visits" />
          <StatCard icon="payments" value={readyForPayment.length} label="Ready for Payment" href="/staff/payments" />
          <StatCard icon="groups" value={totalPatientsToday} label="Total Patients" href="/staff/queue" />
        </div>

        <div className="flex flex-wrap gap-md">
          <Link href="/staff/walk-in">
            <Button>
              <Icon name="directions_walk" className="text-[20px]" />
              New Walk-In
            </Button>
          </Link>
          <Link href="/staff/payments">
            <Button variant="secondary">Payments</Button>
          </Link>
          <Link href="/staff/doctor-status">
            <Button variant="secondary">Doctor Status</Button>
          </Link>
          <Link href="/staff/patients">
            <Button variant="secondary">Patients</Button>
          </Link>
        </div>

        {readyForPayment.length > 0 && (
          <Toast
            variant="warning"
            message={`${readyForPayment.length} payment(s) ready for collection.`}
            actionLabel="Go to Payments"
            actionHref="/staff/payments"
          />
        )}

        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="border-b border-outline-variant px-lg py-md">
            <h3 className="text-headline-sm text-on-surface">Today&apos;s Queue</h3>
          </div>
          <div className="divide-y divide-outline-variant/30 sm:hidden">
            {todaysQueue.length === 0 ? (
              <p className="px-lg py-xl text-center text-body-md text-on-surface-variant">No patients in today&apos;s queue.</p>
            ) : (
              todaysQueue.map((b) => (
                <div key={b.id} className="space-y-sm p-lg">
                  <div className="flex items-start justify-between gap-md">
                    <div>
                      <p className="text-body-md font-medium text-on-surface">{b.patientName}</p>
                      <p className="text-label-sm text-on-surface-variant">
                        {b.slotStartTime} · Q#{b.queueNumber ?? "—"}
                      </p>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                  <Button variant="secondary" className="w-full" onClick={() => toggleCheckIn(b.id, b.status)}>
                    {b.status === "Confirmed" ? "Check In" : "Undo Check-In"}
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                  <th className="px-lg py-sm">Patient</th>
                  <th className="px-lg py-sm">Time</th>
                  <th className="px-lg py-sm text-center">Queue #</th>
                  <th className="px-lg py-sm">Status</th>
                  <th className="px-lg py-sm text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {todaysQueue.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-container-low">
                    <td className="px-lg py-md">{b.patientName}</td>
                    <td className="px-lg py-md">{b.slotStartTime}</td>
                    <td className="px-lg py-md text-center">{b.queueNumber}</td>
                    <td className="px-lg py-md">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-lg py-md text-right">
                      <Button variant="secondary" onClick={() => toggleCheckIn(b.id, b.status)}>
                        {b.status === "Confirmed" ? "Check In" : "Undo Check-In"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
