"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Tabs } from "@/components/ui/Tabs";
import { queryDoctors } from "@/lib/data/doctors";
import { queryStaffBookings, queryBookings } from "@/lib/data/bookings";
import type { BookingStatus } from "@/data/types";

const ALL_STATUSES: BookingStatus[] = [
  "Pending", "ProofSubmitted", "Confirmed", "CheckedIn", "InProgress", "OnHold", "Cancelled", "Completed", "Expired", "NoShow", "Rescheduled",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

interface WeekVisit {
  id: string;
  doctorId: string;
  patientName: string;
  appointmentDate: string;
  slotStartTime: string;
}

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatShort(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

// Stitch bookings_list_admin + clinic_calendar_admin, folded into one screen:
// both showed the same visit history, just as a searchable table vs. a weekly
// grid. One "Bookings" surface now, with List/Week as a view toggle instead
// of two separate nav items. /admin/calendar redirects here.
export default function AdminBookingsPage() {
  const [view, setView] = useState<"list" | "week">("list");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  useEffect(() => {
    async function loadDoctors() {
      const supabase = null as never;
      const rows = await queryDoctors(supabase);
      setDoctors(rows.map((d) => ({ id: d.doctor_id, name: d.staff_accounts?.full_name ?? "" })));
    }
    loadDoctors();
  }, []);

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Bookings</h2>
          <Link href="/admin/walk-in">
            <Button>New Walk-In</Button>
          </Link>
        </div>

        <Tabs
          tabs={[
            { id: "list", label: "List" },
            { id: "week", label: "Week" },
          ]}
          activeId={view}
          onChange={(id) => setView(id as "list" | "week")}
        />

        {view === "list" ? <BookingsList doctors={doctors} /> : <BookingsWeek />}
      </div>
    </AppShell>
  );
}

function BookingsList({ doctors }: { doctors: DoctorOption[] }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  // admin.md §2: date filter was a fully decorative input with no value/onChange at all.
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // §16.2 — debounce the free-text search into a server query.
    const handle = setTimeout(async () => {
      const supabase = null as never;
      try {
        const rows = await queryStaffBookings(supabase, "all", { q: search.trim() || undefined });
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
      } finally {
        if (!cancelled) setLoading(false);
      }
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
    <>
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
        loading={loading}
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
    </>
  );
}

// §16.3: no appointment slots — the time shown is the walk-in check-in time.
// Takes its own doctor roster (rather than the List tab's) so an inactive
// doctor with old bookings can still show up as a List filter option without
// getting a permanent empty row on the Week grid.
function BookingsWeek() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookings, setBookings] = useState<WeekVisit[]>([]);
  const [activeDoctors, setActiveDoctors] = useState<DoctorOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const weekStart = useMemo(() => addDays(mondayOf(new Date()), weekOffset * 7), [weekOffset]);
  const weekDates = useMemo(() => DAYS.map((_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = weekDates[6];
  const weekStartIso = toISODate(weekStart);
  const weekEndIso = toISODate(weekEnd);

  useEffect(() => {
    async function loadDoctors() {
      const supabase = null as never;
      const rows = await queryDoctors(supabase);
      setActiveDoctors(
        rows
          .filter((d) => d.staff_accounts?.status !== "Inactive")
          .map((d) => ({ id: d.doctor_id, name: d.staff_accounts?.full_name ?? "Unknown doctor" })),
      );
    }
    loadDoctors();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBookings() {
      setLoaded(false);
      const supabase = null as never;
      const rows = await queryBookings(supabase, { from: weekStartIso, to: weekEndIso });
      if (cancelled) return;
      setBookings(
        rows
          .filter((b) => b.status !== "Cancelled" && b.status !== "Expired")
          .map((b) => ({
            id: b.booking_id,
            doctorId: b.doctor_id,
            patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "Unknown patient",
            appointmentDate: b.appointment_date,
            slotStartTime: (b.slot_start_time ?? "").slice(0, 5),
          }))
          .sort((a, b) => a.slotStartTime.localeCompare(b.slotStartTime)),
      );
      setLoaded(true);
    }
    loadBookings();
    return () => {
      cancelled = true;
    };
  }, [weekStartIso, weekEndIso]);

  return (
    <div className="space-y-lg">
      <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className="rounded-lg border border-outline-variant px-md py-sm">
          ◀ Prev Week
        </button>
        <h3 className="text-center text-headline-sm text-on-surface">
          {formatShort(weekStart)} - {formatShort(weekEnd)}, {weekEnd.getFullYear()}
        </h3>
        <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="rounded-lg border border-outline-variant px-md py-sm">
          Next Week ▶
        </button>
      </div>

      {!loaded ? (
        <p className="text-body-md text-on-surface-variant">Loading week…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                {activeDoctors.length > 1 && (
                  <th className="border-b border-outline-variant px-md py-sm text-left text-label-md text-on-surface-variant">Doctor</th>
                )}
                {DAYS.map((d, i) => (
                  <th key={d} className="border-b border-outline-variant px-md py-sm text-left text-label-md text-on-surface-variant">
                    {d} <span className="text-on-surface-variant/70">{weekDates[i].getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDoctors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-md py-lg text-body-md text-on-surface-variant">
                    No doctors found.
                  </td>
                </tr>
              ) : (
                activeDoctors.map((doc) => (
                  <tr key={doc.id} className="border-b border-outline-variant/40">
                    {activeDoctors.length > 1 && (
                      <td className="px-md py-md text-body-md text-on-surface">{doc.name}</td>
                    )}
                    {weekDates.map((date) => {
                      const iso = toISODate(date);
                      const dayBookings = bookings.filter((b) => b.doctorId === doc.id && b.appointmentDate === iso);
                      return (
                        <td key={iso} className="px-md py-md align-top">
                          {dayBookings.length === 0 ? (
                            <span className="text-label-sm text-on-surface-variant/60">—</span>
                          ) : (
                            dayBookings.map((b) => (
                              <Link
                                key={b.id}
                                href={`/admin/bookings/${b.id}`}
                                className="mb-xs block rounded bg-primary/10 px-xs py-1 text-[11px] text-primary hover:bg-primary/20"
                              >
                                {b.patientName} · {b.slotStartTime}
                              </Link>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
