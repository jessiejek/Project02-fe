"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill, statusLabel } from "@/components/ui/StatusPill";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateShort, formatClockTime, orDash } from "@/lib/format";
import { showPaymentStatus } from "@/lib/paymentDisplay";
import { DatePicker } from "@/components/ui/DatePicker";
import { Tabs } from "@/components/ui/Tabs";
import { manilaTodayAsLocalDate } from "@/lib/clock";
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
        <PageHeader
          title="Bookings"
          description="Every visit across all doctors. Search by patient or booking ID, or switch to the week view to see the schedule."
          actions={<Link href="/admin/walk-in" className={buttonStyles("primary")}><Icon name="add_circle" className="text-[16px]" />New walk-in</Link>}
        />

        <Tabs
          tabs={[
            { id: "list", label: "List" },
            { id: "week", label: "Week view" },
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
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    //JJQR - AI (Oct 31, 2026)
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    //JJQR - END
    // §16.2 — debounce the free-text search into a server query.
    const handle = setTimeout(async () => {
      const supabase = null as never;
      try {
        const rows = await queryStaffBookings(supabase, "all", { q: search.trim() || undefined });
        if (cancelled) return;
        setLoadError("");
        setBookings(
          rows.map((b) => ({
            id: b.booking_id,
            patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
            patientCode: b.patients?.patient_code ?? "",
            doctorId: b.doctor_id,
            doctorName: b.doctors?.staff_accounts?.full_name ?? "",
            appointmentDate: b.appointment_date,
            status: b.status,
            paymentStatus: b.payments?.status ?? "Unpaid",
          })),
        );
      } catch {
        if (!cancelled) setLoadError("Bookings could not be loaded. Nothing has changed; try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, reloadKey]);

  const rows = bookings.filter((b) => {
    if (doctorFilter !== "all" && b.doctorId !== doctorFilter) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (dateFilter && b.appointmentDate !== dateFilter) return false;
    if (search && !`${b.patientName} ${b.patientCode} ${b.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filtered = doctorFilter !== "all" || statusFilter !== "all" || Boolean(dateFilter) || Boolean(search);

  return (
    <>
      <div role="search" className="grid grid-cols-1 gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-xs">
          <span className="text-label-md text-on-surface-variant">Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient name, code or booking ID" className={inputStyles()} />
        </label>
        <label className="space-y-xs">
          <span className="text-label-md text-on-surface-variant">Doctor</span>
          <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className={inputStyles()}>
            <option value="all">All doctors</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="space-y-xs">
          <span className="text-label-md text-on-surface-variant">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputStyles()}>
            <option value="all">All statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <div className="space-y-xs">
          <span className="block text-label-md text-on-surface-variant">Visit date</span>
          <DatePicker value={dateFilter} onChange={setDateFilter} placeholder="Any date" />
        </div>
      </div>

      {loadError ? (
        <ErrorState title="Bookings unavailable" message={loadError} onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
      ) : (
        <>
          {!loading && (
            <div className="flex flex-wrap items-center justify-between gap-sm text-label-md text-on-surface-variant">
              <p className="tabular-nums" aria-live="polite">{rows.length} {rows.length === 1 ? "booking" : "bookings"}{filtered ? " match these filters" : ""}</p>
              {filtered && (
                <Button variant="ghost" className="min-h-9 px-md py-xs" onClick={() => { setDoctorFilter("all"); setStatusFilter("all"); setDateFilter(""); setSearch(""); }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
          <DataTable
            columns={[
              { header: "Patient", render: (r) => <span><span className="font-medium text-on-surface">{orDash(r.patientName)}</span> {r.patientCode && <span className="ml-xs font-mono text-body-sm text-on-surface-variant">{r.patientCode}</span>}</span> },
              { header: "Visit date", render: (r) => <span className="tabular-nums">{formatClinicDateShort(r.appointmentDate)}</span> },
              { header: "Doctor", render: (r) => orDash(r.doctorName) },
              { header: "Status", render: (r) => <StatusPill status={r.status} /> },
              { header: "Payment", render: (r) => showPaymentStatus(r.status, r.paymentStatus) ? <StatusPill status={r.paymentStatus} /> : <span className="text-on-surface-variant">—</span> },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/admin/bookings/${r.id}`}
            loading={loading}
            emptyMessage={filtered ? "No bookings match these filters." : "No bookings yet."}
            renderMobileCard={(r) => (
              <div className="space-y-xs">
                <div className="flex items-start justify-between gap-md">
                  <p className="min-w-0 text-body-md font-medium text-on-surface">{orDash(r.patientName)} {r.patientCode && <span className="font-mono text-body-sm font-normal text-on-surface-variant">{r.patientCode}</span>}</p>
                  <StatusPill status={r.status} />
                </div>
                <p className="text-label-md text-on-surface-variant"><span className="tabular-nums">{formatClinicDateShort(r.appointmentDate)}</span> · {orDash(r.doctorName)}</p>
                {showPaymentStatus(r.status, r.paymentStatus) && <StatusPill status={r.paymentStatus} />}
              </div>
            )}
          />
        </>
      )}
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
  const [weekError, setWeekError] = useState(false);
  const [weekReload, setWeekReload] = useState(0);

  const weekStart = useMemo(() => addDays(mondayOf(manilaTodayAsLocalDate()), weekOffset * 7), [weekOffset]);
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
      let rows: Awaited<ReturnType<typeof queryBookings>>;
      try {
        rows = await queryBookings(supabase, { from: weekStartIso, to: weekEndIso });
      } catch {
        if (!cancelled) { setWeekError(true); setLoaded(true); }
        return;
      }
      if (cancelled) return;
      setWeekError(false);
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
  }, [weekStartIso, weekEndIso, weekReload]);

  return (
    <div className="space-y-lg">
      <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" onClick={() => setWeekOffset((w) => w - 1)}>
          <Icon name="chevron_left" className="text-[14px]" />Previous week
        </Button>
        <div className="text-center">
          <h2 className="text-headline-sm tabular-nums text-on-surface" aria-live="polite">
            {formatShort(weekStart)} – {formatShort(weekEnd)}, {weekEnd.getFullYear()}
          </h2>
          {weekOffset !== 0 && (
            <button type="button" onClick={() => setWeekOffset(0)} className="min-h-9 text-label-md font-medium text-primary hover:underline">Back to this week</button>
          )}
        </div>
        <Button variant="secondary" onClick={() => setWeekOffset((w) => w + 1)}>
          Next week<Icon name="chevron_right" className="text-[14px]" />
        </Button>
      </div>

      {loaded && weekError ? (
        <ErrorState title="Week unavailable" message="This week's visits could not be loaded. Try again." onRetry={() => setWeekReload((k) => k + 1)} />
      ) : !loaded ? (
        <div role="status" aria-busy="true" className="space-y-sm">
          <p className="sr-only">Loading week…</p>
          {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-container-high motion-reduce:animate-none" />)}
        </div>
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
                    {d} <span className="tabular-nums text-on-surface">{weekDates[i].getDate()}</span>
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
                            <span className="text-label-md text-on-surface-variant" aria-label="No visits">—</span>
                          ) : (
                            dayBookings.map((b) => (
                              <Link
                                key={b.id}
                                href={`/admin/bookings/${b.id}`}
                                className="mb-xs block rounded-md bg-primary/10 px-sm py-xs text-label-md text-on-primary-fixed-variant hover:bg-primary/20"
                              >
                                <span className="block break-words">{b.patientName}</span>
                                <span className="tabular-nums text-on-surface-variant">{formatClockTime(b.slotStartTime)}</span>
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
