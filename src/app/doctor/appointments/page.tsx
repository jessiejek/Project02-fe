"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctorBookings } from "@/lib/data/bookings";

interface AppointmentRow {
  id: string;
  patientName: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
  paymentStatus: string;
}

// Stitch appointments_list_doctor. Retiring mockBookings per
// Implementation-Phases/06-booking-flow.md.
export default function DoctorAppointmentsPage() {
  const { session } = useSession();
  const meDoctorId = session?.staffId ?? "";
  const [bookings, setBookings] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Defaults to today, like every other daily-queue view in the app — this
  // page was pulling every booking ever made with no date scoping at all,
  // which only gets worse as visit history piles up. "All" is one click away.
  const [scope, setScope] = useState<"today" | "all">("today");

  useEffect(() => {
    if (!meDoctorId) return;
    async function load() {
      setLoading(true);
      const supabase = null as never;
      try {
        const rows = await queryDoctorBookings(supabase, meDoctorId, { today: scope === "today" });
        setBookings(
          rows.map((b) => ({
            id: b.booking_id,
            patientName: [b.patients?.first_name, b.patients?.last_name].filter(Boolean).join(" ") || "—",
            slotStartTime: (b.slot_start_time ?? "").slice(0, 5),
            queueNumber: b.queue_number,
            status: b.status,
            paymentStatus: b.payments?.status ?? "Unpaid",
          })),
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [meDoctorId, scope]);

  const rows = bookings.filter((b) => `${b.patientName} ${b.status}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell role="doctor">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">My Visits</h2>
          <div className="flex overflow-hidden rounded-lg border border-outline-variant text-label-md">
            <button
              type="button"
              onClick={() => setScope("today")}
              className={scope === "today" ? "bg-primary px-md py-xs text-on-primary" : "px-md py-xs text-on-surface-variant"}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={scope === "all" ? "bg-primary px-md py-xs text-on-primary" : "px-md py-xs text-on-surface-variant"}
            >
              All
            </button>
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search visits..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-80"
        />
        <DataTable
          columns={[
            { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
            { header: "Patient", render: (r) => r.patientName },
            { header: "Time", render: (r) => r.slotStartTime },
            { header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { header: "Payment", render: (r) => <StatusPill status={r.paymentStatus} /> },
            {
              header: "Actions",
              align: "right",
              render: (r) =>
                ["CheckedIn", "InProgress"].includes(r.status) ? (
                  <Link href={`/doctor/consultation/${r.id}`}>
                    <Button>Start Consultation</Button>
                  </Link>
                ) : (
                  <Link href={`/doctor/appointments/${r.id}`}>
                    <Button variant="secondary">View</Button>
                  </Link>
                ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          renderMobileCard={(r) => (
            <div className="space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-body-md font-medium text-on-surface">{r.patientName}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {r.slotStartTime} · Q#{r.queueNumber ?? "—"}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>
              <StatusPill status={r.paymentStatus} />
              {["CheckedIn", "InProgress"].includes(r.status) ? (
                <Link href={`/doctor/consultation/${r.id}`} className="block">
                  <Button className="w-full">Start Consultation</Button>
                </Link>
              ) : (
                <Link href={`/doctor/appointments/${r.id}`} className="block">
                  <Button variant="secondary" className="w-full">
                    View
                  </Button>
                </Link>
              )}
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
