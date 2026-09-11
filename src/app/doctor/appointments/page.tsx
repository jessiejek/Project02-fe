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
  patientCode: string;
  serviceNames: string[];
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

  useEffect(() => {
    if (!meDoctorId) return;
    async function load() {
      const supabase = null as never;
      try {
        const rows = await queryDoctorBookings(supabase, meDoctorId);
        setBookings(
          rows.map((b) => ({
            id: b.booking_id,
            patientName: [b.patients?.first_name, b.patients?.last_name].filter(Boolean).join(" ") || "—",
            patientCode: b.patients?.patient_code ?? "",
            serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
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
  }, [meDoctorId]);

  const rows = bookings.filter((b) =>
    `${b.patientName} ${b.patientCode} ${b.serviceNames.join(" ")} ${b.status}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell role="doctor">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">My Appointments</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search appointments..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-80"
        />
        <DataTable
          columns={[
            { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
            {
              header: "Patient",
              render: (r) => (
                <>
                  {r.patientName}
                  {r.patientCode ? <span className="text-on-surface-variant"> ({r.patientCode})</span> : null}
                </>
              ),
            },
            { header: "Service", render: (r) => r.serviceNames.join(", ") || "—" },
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
                  <p className="text-body-md font-medium text-on-surface">
                    {r.patientName}
                    {r.patientCode ? ` (${r.patientCode})` : ""}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {r.slotStartTime} · Q#{r.queueNumber ?? "—"} · {r.serviceNames.join(", ") || "—"}
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
