"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addDaysToDate, todayManila } from "@/lib/clock";
import { ErrorState } from "@/components/ui/ErrorState";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { queryDoctors } from "@/lib/data/doctors";
import { queryReport } from "@/lib/data/admin";
import { queryBookings } from "@/lib/data/bookings";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { formatClinicDate, formatClockTime, formatPeso, orDash } from "@/lib/format";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

interface BookingRow {
  id: string;
  patientName: string;
  doctorName: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
}

interface DoctorLoad {
  id: string;
  name: string;
  bookingCount: number;
}

// Stitch admin_dashboard — 8 stat cards in a 4x2 grid. Was reading
// mockBookings/mockDoctors regardless of what's actually in the database —
// fixed to real queries, using the schema's own v_daily_booking_summary/
// v_unpaid_completed_visits/v_pending_follow_ups views for the aggregate
// stats they were purpose-built for.
export default function AdminDashboardPage() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const loadId = useRef(0);
  const [todaysCount, setTodaysCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [onHoldThisMonth, setOnHoldThisMonth] = useState(0);
  const [unpaidCompleted, setUnpaidCompleted] = useState(0);
  const [noShowsToday, setNoShowsToday] = useState(0);
  const [followUpsDue, setFollowUpsDue] = useState(0);
  const [doctorLoads, setDoctorLoads] = useState<DoctorLoad[]>([]);
  const [recentBookings, setRecentBookings] = useState<BookingRow[]>([]);

  const load = useCallback(async () => {
    const requestId = ++loadId.current;
    setRefreshing(true);
    try {
      const supabase = null as never;
      const today = todayManila();
      const monthStart = `${today.slice(0, 7)}-01`;
      const in7Days = addDaysToDate(today, 7);

      const [dailySummary, unpaidRes, followUpsRes, doctorsRes, allBookings] = await Promise.all([
        //JJQR - AI (Oct 31, 2026)
        queryReport<Record<string, unknown>>(supabase, "v_daily_booking_summary"),
        queryReport<Record<string, unknown>>(supabase, "v_unpaid_completed_visits").then((rows) => ({ count: rows.length })),
        queryReport<Record<string, unknown>>(supabase, "v_pending_follow_ups").then((rows) => ({
        //JJQR - END
          count: rows.filter(
            (r) => (r.follow_up_date as string) >= today && (r.follow_up_date as string) <= in7Days,
          ).length,
        })),
        queryDoctors(supabase),
        queryBookings(supabase, {}),
      ]);

      if (requestId !== loadId.current) return;
      setLoadError("");
      const todaySummary = dailySummary.find((r) => r.appointment_date === today) ?? null;
      const monthSummary = dailySummary.filter((r) => (r.appointment_date as string) >= monthStart);
      const monthBookings = allBookings.filter((b) => b.appointment_date >= monthStart);
      const recent = [...allBookings].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 20);

      //JJQR - AI (Oct 31, 2026)
      setTodaysCount(Number(todaySummary?.total_bookings ?? 0));
      setNoShowsToday(Number(todaySummary?.no_show_count ?? 0));
      //JJQR - END
      setRevenueToday(Number(todaySummary?.revenue ?? 0));
      setMonthlyCount(monthBookings.length);
      setRevenueThisMonth(monthSummary.reduce((sum, d) => sum + Number(d.revenue ?? 0), 0));
      setPendingVerifications(allBookings.filter((b) => b.status === "ProofSubmitted").length);
      setOnHoldThisMonth(monthBookings.filter((b) => b.status === "OnHold").length);
      setUnpaidCompleted(unpaidRes.count ?? 0);
      setFollowUpsDue(followUpsRes.count ?? 0);

      const bookingCountByDoctor = new Map<string, number>();
      recent.forEach((b) => {
        bookingCountByDoctor.set(b.doctor_id, (bookingCountByDoctor.get(b.doctor_id) ?? 0) + 1);
      });
      setDoctorLoads(
        doctorsRes.map((d) => ({
          id: d.doctor_id,
          name: d.staff_accounts?.full_name ?? "",
          bookingCount: bookingCountByDoctor.get(d.doctor_id) ?? 0,
        })),
      );

      setRecentBookings(
        recent.map((b) => ({
          id: b.booking_id,
          patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          slotStartTime: formatClockTime(b.slot_start_time),
          queueNumber: b.queue_number,
          status: b.status,
        })),
      );

    } catch {
      if (requestId === loadId.current) setLoadError("Dashboard data is unavailable. Please try again; no totals are shown while the request has failed.");
    } finally {
      if (requestId === loadId.current) { setLoaded(true); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    async function init() {
      await load();
    }
    init();
    return () => { loadId.current += 1; };
  }, [load]);

  useClinicHubEvent("PatientCheckedIn", load);
  useClinicHubEvent("QueueUpdated", load);
  useClinicHubEvent("PaymentUpdated", load);

  // Fallback poll for a dropped/blocked SignalR connection (same pattern as
  // /staff/queue) — self-corrects within a minute if push doesn't arrive.
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!loaded) {
    return (
      <AppShell role="admin">
        <div className="space-y-xl" aria-busy="true">
          <p className="sr-only" role="status">Loading clinic overview…</p>
          <SkeletonStats count={8} />
          <SkeletonTable rows={5} columns={4} />
        </div>
      </AppShell>
    );
  }

  if (loadError) return <AppShell role="admin"><ErrorState title="Dashboard unavailable" message={loadError} onRetry={load} retrying={refreshing} /></AppShell>;

  const maxLoad = Math.max(1, ...doctorLoads.map((d) => d.bookingCount));

  return (
    <AppShell role="admin">
      <div className="space-y-xl">
        <PageHeader
          title="Clinic overview"
          description={<>Today is {formatClinicDate(todayManila())}. Figures refresh automatically when the queue or payments change.</>}
          actions={<Button variant="secondary" onClick={load} loading={refreshing}>Refresh</Button>}
        />

        <section aria-labelledby="today-heading" className="space-y-md">
          <h2 id="today-heading" className="text-headline-md text-on-surface">Today</h2>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <StatCard icon="event_note" value={todaysCount} label="Appointments today" href="/admin/bookings" />
            <StatCard icon="payments" value={formatPeso(revenueToday, "₱0")} label="Revenue today" href="/admin/reports" />
            <StatCard icon="event_busy" value={noShowsToday} label="No-shows today" />
          </div>
        </section>

        <section aria-labelledby="action-heading" className="space-y-md">
          <h2 id="action-heading" className="text-headline-md text-on-surface">Needs follow-up</h2>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon="pending_actions" value={pendingVerifications} label="Payment proofs to verify" href="/admin/bookings" />
            <StatCard icon="receipt_long" value={unpaidCompleted} label="Completed visits not yet paid" href="/admin/reports" />
            <StatCard icon="hourglass_top" value={onHoldThisMonth} label="On hold this month" href="/admin/bookings" />
            <StatCard icon="follow_the_signs" value={followUpsDue} label="Follow-ups due in 7 days" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
          <section aria-labelledby="month-heading" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
            <h2 id="month-heading" className="text-headline-sm text-on-surface">This month</h2>
            <p className="mt-md text-headline-lg tabular-nums text-on-surface">{formatPeso(revenueThisMonth, "₱0")}</p>
            <p className="text-label-md text-on-surface-variant">Revenue</p>
            <p className="mt-md text-headline-md tabular-nums text-on-surface">{monthlyCount}</p>
            <p className="text-label-md text-on-surface-variant">Appointments</p>
          </section>
          <section aria-labelledby="load-heading" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg lg:col-span-2">
            <h2 id="load-heading" className="text-headline-sm text-on-surface">Doctor share of the latest 20 bookings</h2>
            <div className="mt-md space-y-sm">
              {doctorLoads.length === 0 && <p className="text-body-md text-on-surface-variant">No doctors to show.</p>}
              {doctorLoads.map((d) => (
                <div key={d.id} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-md">
                  <span className="break-words text-label-md text-on-surface">{orDash(d.name)}</span>
                  <div aria-hidden="true" className="h-2 rounded-full bg-surface-container-high">
                    <div className="h-2 rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(d.bookingCount / maxLoad) * 100}%` }} />
                  </div>
                  <span className="text-right text-label-md tabular-nums text-on-surface">{d.bookingCount}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section aria-labelledby="recent-heading" className="space-y-md">
          <div className="flex flex-wrap items-baseline justify-between gap-md">
            <h2 id="recent-heading" className="text-headline-md text-on-surface">Latest bookings</h2>
            <Link href="/admin/bookings" className="text-label-md font-medium text-primary hover:underline">All bookings</Link>
          </div>
        <DataTable
          columns={[
            { header: "Patient", render: (r) => <span className="font-medium text-on-surface">{orDash(r.patientName)}</span> },
            { header: "Doctor", render: (r) => orDash(r.doctorName) },
            { header: "Time", render: (r) => r.slotStartTime },
            { header: "Queue", align: "center", render: (r) => <span className="tabular-nums">{r.queueNumber ?? "—"}</span> },
            { header: "Status", render: (r) => <StatusPill status={r.status} /> },
          ]}
          rows={recentBookings}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/bookings/${r.id}`}
          renderMobileCard={(r) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between gap-md">
                <p className="text-body-md font-medium text-on-surface">{r.patientName}</p>
                <StatusPill status={r.status} />
              </div>
              <p className="text-label-md text-on-surface-variant">{r.doctorName}</p>
              <p className="text-label-sm text-on-surface-variant">
                <span className="tabular-nums">{r.slotStartTime} · Queue {r.queueNumber ?? "—"}</span>
              </p>
            </div>
          )}
          emptyMessage="No bookings yet."
        />
        </section>
      </div>
    </AppShell>
  );
}
