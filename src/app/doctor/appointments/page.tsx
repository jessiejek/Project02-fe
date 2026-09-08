"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";

interface AppointmentRow {
  id: string;
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
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!meDoctorId) return;
    async function load() {
      const supabase = createClient();
      const [bookingsRes, servicesRes, paymentsRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("doctor_id", meDoctorId).order("appointment_date", { ascending: false }),
        supabase.from("booking_services").select("booking_id, services(name)"),
        supabase.from("payments").select("booking_id, status"),
      ]);
      const paymentByBooking = new Map((paymentsRes.data ?? []).map((p) => [p.booking_id, p.status]));
      const servicesByBooking = new Map<string, string[]>();
      for (const row of servicesRes.data ?? []) {
        const service = Array.isArray(row.services) ? row.services[0] : row.services;
        const list = servicesByBooking.get(row.booking_id) ?? [];
        list.push(service?.name ?? "");
        servicesByBooking.set(row.booking_id, list);
      }
      setBookings(
        (bookingsRes.data ?? []).map((b) => ({
          id: b.booking_id,
          serviceNames: servicesByBooking.get(b.booking_id) ?? [],
          slotStartTime: b.slot_start_time.slice(0, 5),
          queueNumber: b.queue_number,
          status: b.status,
          paymentStatus: paymentByBooking.get(b.booking_id) ?? "Unpaid",
        })),
      );
    }
    load();
  }, [meDoctorId]);

  const rows = bookings.filter((b) => `${b.serviceNames.join(" ")} ${b.status}`.toLowerCase().includes(search.toLowerCase()));

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
            { header: "Service", render: (r) => r.serviceNames.join(", ") },
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
          renderMobileCard={(r) => (
            <div className="space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-body-md font-medium text-on-surface">{r.serviceNames.join(", ") || "Appointment"}</p>
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
