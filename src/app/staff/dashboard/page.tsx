"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";

interface QueueRow {
  id: string;
  patientName: string;
  doctorName: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
  paymentStatus: string;
  isWalkIn: boolean;
}

// Stitch staff_dashboard. Was reading mockBookings regardless of what's
// actually scheduled today — fixed to a real query scoped to today's date,
// matching the pattern already used by doctor/dashboard.
export default function StaffDashboardPage() {
  const [loaded, setLoaded] = useState(false);
  const [bookings, setBookings] = useState<QueueRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("bookings")
        .select("*, patients(first_name, last_name), doctors(staff_accounts(full_name)), payments(status)")
        .eq("appointment_date", today);
      const rows: QueueRow[] = (data ?? []).map((b) => {
        const patient = Array.isArray(b.patients) ? b.patients[0] : b.patients;
        const doctor = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
        const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
        const payment = Array.isArray(b.payments) ? b.payments[0] : b.payments;
        return {
          id: b.booking_id,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : "",
          doctorName: staff?.full_name ?? "",
          slotStartTime: b.slot_start_time.slice(0, 5),
          queueNumber: b.queue_number,
          status: b.status,
          paymentStatus: payment?.status ?? "Unpaid",
          isWalkIn: b.is_walk_in,
        };
      });
      setBookings(rows);
      setLoaded(true);
    }
    load();
  }, []);

  const todaysQueue = bookings.filter((b) => ["Confirmed", "CheckedIn"].includes(b.status));
  const readyForPayment = bookings.filter((b) => b.status === "Completed" && b.paymentStatus === "Unpaid");
  const walkInsToday = bookings.filter((b) => b.isWalkIn);

  async function toggleCheckIn(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "Confirmed" ? "CheckedIn" : "Confirmed";
    const supabase = createClient();
    await supabase.from("bookings").update({ status: nextStatus }).eq("booking_id", id);
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

        <div className="grid grid-cols-1 gap-lg md:grid-cols-4">
          <StatCard icon="event_note" value={todaysQueue.length} label="Today's Appointments" />
          <StatCard icon="payments" value={readyForPayment.length} label="Ready for Payment" href="/staff/payments" />
          <StatCard icon="directions_walk" value={walkInsToday.length} label="Walk-Ins Today" href="/staff/bookings?filter=walkin" />
          <StatCard icon="check_circle" value={todaysQueue.length} label="Confirmed Today" />
        </div>

        <div className="flex flex-wrap gap-md">
          <Link href="/staff/walk-in">
            <Button>
              <Icon name="directions_walk" className="text-[20px]" />
              New Walk-In
            </Button>
          </Link>
          <Link href="/staff/payments">
            <Button variant="secondary">Payment Queue</Button>
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
            actionLabel="Go to Queue"
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
                        {b.doctorName} · {b.slotStartTime} · Q#{b.queueNumber ?? "—"}
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
                  <th className="px-lg py-sm">Doctor</th>
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
                    <td className="px-lg py-md">{b.doctorName}</td>
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
