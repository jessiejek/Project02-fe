"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
import { queryStaffBookings } from "@/lib/data/bookings";

interface BookingRow {
  id: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceNames: string[];
  appointmentDate: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
  paymentStatus: string;
  isWalkIn: boolean;
}

interface DoctorOption {
  id: string;
  name: string;
}

// Stitch bookings_list (staff). Retiring mockBookings per
// Implementation-Phases/06-booking-flow.md.
export default function StaffBookingsPage() {
  return (
    <Suspense
      fallback={
        <AppShell role="staff">
          <p className="text-body-md text-on-surface-variant">Loading bookings...</p>
        </AppShell>
      }
    >
      <StaffBookingsContent />
    </Suspense>
  );
}

function StaffBookingsContent() {
  const searchParams = useSearchParams();
  const walkInOnly = searchParams.get("filter") === "walkin";
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // Staff.md §2: "Date (default today)" — now the real current date, not the
  // fixed mock date this defaulted to before.
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [rows, doctorsRes] = await Promise.all([
        queryStaffBookings(supabase, "all"),
        queryDoctors(supabase),
      ]);
      setBookings(
        rows.map((b) => ({
          id: b.booking_id,
          patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
          doctorId: b.doctor_id,
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
          appointmentDate: b.appointment_date,
          slotStartTime: b.slot_start_time.slice(0, 5),
          queueNumber: b.queue_number,
          status: b.status,
          paymentStatus: b.payments?.status ?? "Unpaid",
          isWalkIn: b.is_walk_in,
        })),
      );
      setDoctors(
        doctorsRes.map((d) => ({ id: d.doctor_id, name: d.staff_accounts?.full_name ?? "" })),
      );
    }
    load();
  }, []);

  const rows = bookings.filter((b) => {
    if (walkInOnly && !b.isWalkIn) return false;
    if (doctorFilter !== "all" && b.doctorId !== doctorFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (dateFilter && b.appointmentDate !== dateFilter) return false;
    return true;
  });

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">{walkInOnly ? "Walk-In Bookings" : "Bookings Management"}</h2>
          <Link href="/staff/walk-in">
            <Button>New Walk-In</Button>
          </Link>
        </div>

        {walkInOnly && (
          <p className="text-label-md text-on-surface-variant">
            Showing walk-in bookings only.{" "}
            <Link href="/staff/bookings" className="text-primary hover:underline">
              Clear walk-in filter
            </Link>
          </p>
        )}

        <Card>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm">
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm">
              <option value="all">All Statuses</option>
              {["Confirmed", "CheckedIn", "Completed", "Cancelled", "NoShow"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-sm">
              <DatePicker value={dateFilter} onChange={setDateFilter} className="min-w-0 flex-1" />
              {dateFilter && (
                <button type="button" onClick={() => setDateFilter("")} className="shrink-0 text-label-sm text-primary hover:underline">
                  Show all dates
                </button>
              )}
            </div>
          </div>
        </Card>

        <DataTable
          columns={[
            { header: "Patient", render: (r) => r.patientName },
            { header: "Doctor / Services", render: (r) => `${r.doctorName} — ${r.serviceNames.join(", ")}` },
            { header: "Date / Time", render: (r) => `${r.appointmentDate} · ${r.slotStartTime}` },
            { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
            { header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { header: "Payment", render: (r) => <StatusPill status={r.paymentStatus} /> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/staff/bookings/${r.id}`}
          renderMobileCard={(r) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-medium text-on-surface">{r.patientName}</p>
                <StatusPill status={r.status} />
              </div>
              <p className="text-label-md text-on-surface-variant">{r.doctorName} — {r.serviceNames.join(", ")}</p>
              <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                <span>{r.appointmentDate} · {r.slotStartTime} · Q#{r.queueNumber ?? "—"}</span>
                <StatusPill status={r.paymentStatus} />
              </div>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
