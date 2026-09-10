"use client";

import { useEffect, useState } from "react";
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
import type { BookingStatus } from "@/data/types";

const ALL_STATUSES: BookingStatus[] = [
  "Pending", "ProofSubmitted", "Confirmed", "CheckedIn", "InProgress", "OnHold", "Cancelled", "Completed", "Expired", "NoShow", "Rescheduled",
];

interface BookingRow {
  id: string;
  patientName: string;
  patientCode: string;
  doctorId: string;
  doctorName: string;
  serviceNames: string[];
  appointmentDate: string;
  status: string;
  paymentStatus: string;
}

interface DoctorOption {
  id: string;
  name: string;
}

// Stitch bookings_list_admin. Retiring mockBookings per
// Implementation-Phases/06-booking-flow.md.
export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  // admin.md §2: date filter was a fully decorative input with no value/onChange at all.
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    // §16.2 — debounce the free-text search into a server query.
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const [rows, doctorsRes] = await Promise.all([
        queryStaffBookings(supabase, "all", { q: search.trim() || undefined }),
        queryDoctors(supabase),
      ]);
      if (cancelled) return;
      setBookings(
        rows.map((b) => ({
          id: b.booking_id,
          patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
          patientCode: b.patients?.patient_code ?? "",
          doctorId: b.doctor_id,
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
          appointmentDate: b.appointment_date,
          status: b.status,
          paymentStatus: b.payments?.status ?? "Unpaid",
        })),
      );
      setDoctors(
        doctorsRes.map((d) => ({ id: d.doctor_id, name: d.staff_accounts?.full_name ?? "" })),
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search]);

  const rows = bookings.filter((b) => {
    if (doctorFilter !== "all" && b.doctorId !== doctorFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (dateFilter && b.appointmentDate !== dateFilter) return false;
    if (search && !`${b.patientName} ${b.patientCode} ${b.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Bookings Management</h2>
          <Link href="/admin/walk-in">
            <Button>New Walk-In</Button>
          </Link>
        </div>

        <Card className="grid grid-cols-1 gap-md sm:grid-cols-4">
          <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm">
            <option value="all">All Doctors</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm">
            <option value="all">All Statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <DatePicker value={dateFilter} onChange={setDateFilter} placeholder="Any date" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient/booking ID" className="rounded-lg border border-outline-variant px-md py-sm" />
        </Card>

        <DataTable
          columns={[
            { header: "Patient", render: (r) => `${r.patientName} (${r.patientCode})` },
            { header: "Doctor", render: (r) => `${r.doctorName} — ${r.serviceNames.join(", ")}` },
            { header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { header: "Payment", render: (r) => <StatusPill status={r.paymentStatus} /> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/bookings/${r.id}`}
          renderMobileCard={(r) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-medium text-on-surface">{r.patientName} <span className="text-label-sm text-on-surface-variant">({r.patientCode})</span></p>
                <StatusPill status={r.status} />
              </div>
              <p className="text-label-md text-on-surface-variant">{r.doctorName} — {r.serviceNames.join(", ")}</p>
              <div className="flex justify-end">
                <StatusPill status={r.paymentStatus} />
              </div>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
