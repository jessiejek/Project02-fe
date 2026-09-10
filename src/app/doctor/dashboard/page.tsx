"use client";

import Link from "next/link";
import { todayManila } from "@/lib/clock";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { queryDoctorEarnings, type DoctorEarningsRow } from "@/lib/data/admin";
import { queryDayStatus, setDayStatus as saveDayStatus } from "@/lib/data/scheduling";
import { queryDoctorBookings } from "@/lib/data/bookings";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

type DayStatus = "Available" | "RunningLate" | "UnavailableToday";

interface QueueRow {
  id: string;
  patientId: string;
  patientName: string;
  serviceNames: string[];
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
}

// Stitch doctor_dashboard.
export default function DoctorDashboardPage() {
  const { session } = useSession();
  const meDoctorId = session?.staffId ?? "";
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [dayStatus, setDayStatus] = useState<DayStatus>("Available");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [earnings, setEarnings] = useState<DoctorEarningsRow[]>([]);

  useEffect(() => {
    if (!meDoctorId) return;
    async function load() {
      const supabase = createClient();
      const today = todayManila();
      const [statusRow, todaysBookings] = await Promise.all([
        queryDayStatus(supabase, meDoctorId, today),
        queryDoctorBookings(supabase, meDoctorId, { today: true }),
      ]);
      setName(session?.displayName ?? "");
      setDayStatus((statusRow?.status as DayStatus) ?? "Available");
      const rows: QueueRow[] = todaysBookings
        .map((b) => ({
          id: b.booking_id,
          patientId: b.patient_id,
          patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
          serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
          slotStartTime: (b.slot_start_time ?? "").slice(0, 5),
          queueNumber: b.queue_number,
          status: b.status,
        }))
        .sort((a, b) => (a.queueNumber ?? "").localeCompare(b.queueNumber ?? ""));
      setQueue(rows);
      try {
        setEarnings(await queryDoctorEarnings(supabase, meDoctorId));
      } catch {
        setEarnings([]);
      }
      setLoaded(true);
    }
    load();
  }, [meDoctorId]);

  const upNext = queue.find((b) => b.status === "Confirmed");

  async function setStatus(status: DayStatus) {
    const supabase = createClient();
    const today = todayManila();
    await saveDayStatus(supabase, meDoctorId, today, status);
    setDayStatus(status);
  }

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading your dashboard…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor" roleBadge={<StatusPill status={dayStatus} />}>
      <div className="space-y-xl">
        <div>
          <h2 className="text-headline-lg text-on-surface">Good morning, {name}</h2>
          <p className="text-body-md text-on-surface-variant">Shift: 8:00 AM - 5:00 PM</p>
        </div>

        {upNext && (
          <Card className="flex flex-col items-start justify-between gap-md sm:flex-row sm:items-center">
            <div>
              <p className="text-label-sm uppercase text-on-surface-variant">Up Next</p>
              <p className="text-headline-sm text-on-surface">
                Queue #{upNext.queueNumber} — {upNext.patientName} — {upNext.serviceNames.join(", ")}
              </p>
            </div>
            <div className="flex gap-sm">
              <Link href={`/doctor/consultation/${upNext.id}`}>
                <Button>Start Consult</Button>
              </Link>
              <Link href={`/doctor/patients/${upNext.patientId}`}>
                <Button variant="secondary">View Chart</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-lg md:grid-cols-4">
          <Card><p className="text-headline-lg text-on-surface">{queue.length}</p><p className="text-label-md text-on-surface-variant">Booked</p></Card>
          <Card><p className="text-headline-lg text-on-surface">{queue.filter(b => b.status === "Confirmed").length}</p><p className="text-label-md text-on-surface-variant">Waiting</p></Card>
          <Card><p className="text-headline-lg text-on-surface">{queue.filter(b => b.status === "CheckedIn").length}</p><p className="text-label-md text-on-surface-variant">CheckedIn</p></Card>
          <Card><p className="text-headline-lg text-on-surface">{queue.filter(b => b.status === "Completed").length}</p><p className="text-label-md text-on-surface-variant">Completed</p></Card>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="border-b border-outline-variant px-lg py-md">
            <h3 className="text-headline-sm text-on-surface">Today&apos;s Queue</h3>
          </div>
          <div className="divide-y divide-outline-variant/30 sm:hidden">
            {queue.length === 0 ? (
              <p className="px-lg py-xl text-center text-body-md text-on-surface-variant">No appointments today.</p>
            ) : (
              queue.map((b) => (
                <Link key={b.id} href={`/doctor/appointments/${b.id}`} className="block p-lg active:bg-surface-container-low">
                  <div className="flex items-start justify-between gap-md">
                    <div>
                      <p className="text-body-md font-medium text-on-surface">{b.patientName}</p>
                      <p className="text-label-sm text-on-surface-variant">
                        Q#{b.queueNumber ?? "—"} · {b.slotStartTime} · {b.serviceNames.join(", ")}
                      </p>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                  <th className="px-lg py-sm text-center">Queue #</th>
                  <th className="px-lg py-sm">Patient</th>
                  <th className="px-lg py-sm">Service</th>
                  <th className="px-lg py-sm">Time</th>
                  <th className="px-lg py-sm">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {queue.map((b) => (
                  <tr key={b.id} className="cursor-pointer hover:bg-surface-container-low">
                    <td className="px-lg py-md text-center">
                      <Link href={`/doctor/appointments/${b.id}`}>{b.queueNumber ?? "—"}</Link>
                    </td>
                    <td className="px-lg py-md">{b.patientName}</td>
                    <td className="px-lg py-md">{b.serviceNames.join(", ")}</td>
                    <td className="px-lg py-md">{b.slotStartTime}</td>
                    <td className="px-lg py-md"><StatusPill status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-md">
          <Link href="/doctor/appointments"><Button variant="secondary">My Appointments</Button></Link>
          <Link href="/doctor/patients"><Button variant="secondary">My Patients</Button></Link>
          <Link href="/doctor/schedule"><Button variant="secondary">Schedule</Button></Link>
        </div>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Earnings</h3>
          {earnings.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No completed visits yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                <div>
                  <p className="text-headline-sm text-on-surface">{peso(earnings[0].collected)}</p>
                  <p className="text-label-md text-on-surface-variant">Collected ({earnings[0].period})</p>
                </div>
                <div>
                  <p className="text-headline-sm text-on-surface">{peso(earnings[0].gross_billed)}</p>
                  <p className="text-label-md text-on-surface-variant">Billed</p>
                </div>
                <div>
                  <p className="text-headline-sm text-on-surface">{earnings[0].completed_visits}</p>
                  <p className="text-label-md text-on-surface-variant">Visits</p>
                </div>
                <div>
                  <p className="text-headline-sm text-on-surface">{peso(earnings[0].waived)}</p>
                  <p className="text-label-md text-on-surface-variant">Waived</p>
                </div>
              </div>
              {earnings.length > 1 && (
                <div className="mt-md overflow-x-auto">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="text-left text-label-md text-on-surface-variant">
                        <th className="py-xs pr-md">Month</th>
                        <th className="py-xs pr-md text-right">Visits</th>
                        <th className="py-xs pr-md text-right">Billed</th>
                        <th className="py-xs text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {earnings.map((e) => (
                        <tr key={e.period}>
                          <td className="py-xs pr-md">{e.period}</td>
                          <td className="py-xs pr-md text-right">{e.completed_visits}</td>
                          <td className="py-xs pr-md text-right">{peso(e.gross_billed)}</td>
                          <td className="py-xs text-right">{peso(e.collected)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Card>
            <h3 className="mb-md text-headline-sm text-on-surface">Availability</h3>
            <div className="flex flex-wrap gap-sm">
              <Button variant={dayStatus === "Available" ? "primary" : "secondary"} onClick={() => setStatus("Available")}>Available</Button>
              <Button variant={dayStatus === "RunningLate" ? "primary" : "secondary"} onClick={() => setStatus("RunningLate")}>Running Late</Button>
              <Button variant={dayStatus === "UnavailableToday" ? "primary" : "secondary"} onClick={() => setStatus("UnavailableToday")}>Unavailable Today</Button>
            </div>
          </Card>
          <Card>
            <h3 className="mb-md text-headline-sm text-on-surface">Working Schedule</h3>
            <p className="text-body-md text-on-surface-variant">Today: 8:00 AM - 5:00 PM</p>
            <p className="text-body-md text-on-surface-variant">Tomorrow: 8:00 AM - 5:00 PM</p>
            <Link href="/doctor/schedule" className="mt-sm inline-block text-label-md text-primary hover:underline">
              Go to Schedule
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
