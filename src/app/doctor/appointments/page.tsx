"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { AppointmentFocus } from "@/components/doctor/appointments/AppointmentFocus";
import { AppointmentList } from "@/components/doctor/appointments/AppointmentList";
import { filterAppointments, focusAppointment, mapAppointments, orderedAppointments, visitDate, type Appointment, type AppointmentFilter, type AppointmentScope } from "@/components/doctor/appointments/model";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctorBookings } from "@/lib/data/bookings";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";
import { todayManila } from "@/lib/clock";
import { cn } from "@/lib/cn";

const FILTERS: { id: AppointmentFilter; label: string }[] = [{ id: "active", label: "In clinic" }, { id: "waiting", label: "Waiting" }, { id: "in-progress", label: "In progress" }, { id: "completed", label: "Completed" }, { id: "all", label: "All statuses" }];
const PAGE_SIZE = 20;
export default function DoctorAppointmentsPage() {
  const { session } = useSession();
  const doctorId = session?.staffId;
  const [scope, setScope] = useState<AppointmentScope>("today");
  const [snapshot, setSnapshot] = useState<{ scope: AppointmentScope; rows: Appointment[]; at: Date } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AppointmentFilter>("active");
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!doctorId) return;
    const id = ++requestId.current;
    setFetching(true);
    try {
      const data = await queryDoctorBookings(null, doctorId, { today: scope === "today" });
      if (id !== requestId.current) return;
      setSnapshot({ scope, rows: orderedAppointments(mapAppointments(data), scope), at: new Date() });
      setError("");
    } catch {
      if (id === requestId.current) setError("Appointments could not be refreshed. Please try again.");
    } finally { if (id === requestId.current) setFetching(false); }
  }, [doctorId, scope]);
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) void load(); }); return () => { cancelled = true; requestId.current += 1; }; }, [load]);
  useEffect(() => { const timer = setInterval(() => void load(), 60_000); return () => clearInterval(timer); }, [load]);
  useClinicHubEvent("PatientCheckedIn", load);
  useClinicHubEvent("QueueUpdated", load);
  useClinicHubEvent("PaymentUpdated", load);

  const current = snapshot?.scope === scope ? snapshot : null;
  const appointments = current?.rows ?? [];
  const loading = fetching && !current;
  const shown = filterAppointments(appointments, filter, search);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function changeScope(next: AppointmentScope) { if (scope === next) return; setScope(next); setError(""); setFetching(true); setPage(1); setSearch(""); setFilter(next === "all" ? "all" : "active"); }
  const waiting = appointments.filter(row => row.status === "CheckedIn").length;
  const inProgress = appointments.filter(row => row.status === "InProgress").length;
  const completed = appointments.filter(row => row.status === "Completed").length;

  if (session && !session.staffId) return <AppShell role="doctor"><DoctorPageHeader title="Doctor profile not linked" description="Ask your clinic administrator to link your account to a doctor profile before opening patient records." /></AppShell>;
  return <AppShell role="doctor"><div className="space-y-xl">
    <DoctorPageHeader title={scope === "today" ? "Today's appointments" : "Appointment history"} description={scope === "today" ? <><span className="tabular-nums">{visitDate(todayManila())}</span> · Your patient queue and consultations</> : "Review your previous and upcoming visits, with the date of every appointment."} actions={<div className="flex rounded-xl border border-outline-variant bg-surface-container-lowest p-xs" role="group" aria-label="Appointment date range">{(["today", "all"] as const).map(value => <button key={value} type="button" aria-pressed={scope === value} onClick={() => changeScope(value)} className={cn("min-h-11 rounded-[calc(var(--radius-xl)-var(--spacing-xs))] px-lg text-label-md font-medium transition-colors motion-reduce:transition-none", scope === value ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high")}>{value === "today" ? "Today" : "History"}</button>)}</div>} />
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-md rounded-lg border border-status-danger-border bg-status-danger-surface p-md text-status-danger"><p className="text-body-md">{error}{current && " Showing the last loaded appointments."}</p><Button variant="secondary" loading={fetching} onClick={load}>Try again</Button></div>}
    <section aria-label={scope === "today" ? "Today's queue summary" : "History summary"} className="flex flex-wrap gap-x-xl gap-y-md border-b border-outline-variant pb-lg">{[["Waiting", waiting], ["In progress", inProgress], ["Completed", completed]].map(([label, count]) => <div key={label} className="flex items-baseline gap-sm"><span className="text-headline-md font-semibold tabular-nums text-on-surface">{current ? count : "—"}</span><span className="text-body-md text-on-surface-variant">{label}</span></div>)}</section>
    {scope === "today" && !error && (loading || appointments.length > 0) && <AppointmentFocus appointment={focusAppointment(appointments)} loading={loading} onHistory={() => changeScope("all")} />}
    <section aria-labelledby="appointment-list-title" aria-busy={fetching || undefined} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      <div className="space-y-lg p-lg"><div className="flex flex-wrap items-center justify-between gap-md"><div><h2 id="appointment-list-title" className="text-headline-md font-semibold text-on-surface">{scope === "today" ? "Patient queue" : "All appointments"}</h2><p className="mt-xs text-label-md text-on-surface-variant">{current ? `${shown.length} shown of ${appointments.length} appointments` : "Loading appointments…"}</p></div><Button variant="secondary" onClick={load} loading={fetching}><Icon name="refresh" className="h-4 w-4" />{fetching ? "Refreshing…" : "Refresh"}</Button></div>
        <div className="relative max-w-doctor-search"><Icon name="search" className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" /><label htmlFor="appointment-search" className="sr-only">Search patients, patient IDs or queue numbers</label><input id="appointment-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search patient or queue number" className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-sm pl-11 pr-md text-body-md text-on-surface" /></div>
        <div role="group" aria-label="Filter appointment status" className="flex flex-wrap gap-xs">{FILTERS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPage(1); }} className={cn("min-h-11 rounded-lg border px-md py-sm text-label-md font-medium transition-colors motion-reduce:transition-none", filter === item.id ? "border-primary bg-primary/10 text-primary" : "border-transparent text-on-surface-variant hover:bg-surface-container-low")}>{item.label}</button>)}</div>
      </div>
      {loading ? <div className="p-lg"><SkeletonTable rows={5} columns={4} /></div> : error && !current ? <div className="border-t border-outline-variant px-lg py-xl text-body-md text-on-surface-variant">Appointments are unavailable. Use Try again above to reload them.</div> : shown.length ? <AppointmentList rows={visible} scope={scope} /> : <div className="space-y-md border-t border-outline-variant px-lg py-xl text-center"><Icon name="event_note" className="mx-auto h-7 w-7 text-on-surface-variant" /><h3 className="text-headline-sm font-semibold text-on-surface">{search ? "No matching appointments" : appointments.length ? "No appointments in this view" : scope === "today" ? "No appointments today" : "No appointments yet"}</h3><p className="text-body-md text-on-surface-variant">{search ? "Try a different patient name or queue number." : appointments.length ? "Choose another status to see the rest of your appointments." : "Appointments will appear here when they are booked."}</p>{appointments.length > 0 && (search || filter !== "all") && <Button variant="secondary" onClick={() => { setSearch(""); setFilter("all"); setPage(1); }}>Clear filters</Button>}{!appointments.length && scope === "today" && <Button onClick={() => changeScope("all")}>Review appointment history<Icon name="arrow_forward" className="h-4 w-4" /></Button>}</div>}
      {current && <footer className="flex flex-wrap items-center justify-between gap-md border-t border-outline-variant p-lg"><p className="text-label-sm tabular-nums text-on-surface-variant">Updated {current.at.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })} PHT · Auto-refresh every minute</p>{pages > 1 && <nav aria-label="Appointment pages" className="flex items-center gap-sm"><Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-label-md tabular-nums text-on-surface">{currentPage} / {pages}</span><Button variant="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}</footer>}
    </section>
  </div></AppShell>;
}
