"use client";

import Link from "next/link";
import { todayManila } from "@/lib/clock";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, StatCard } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DatePicker } from "@/components/ui/DatePicker";
import { DataTable } from "@/components/ui/DataTable";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctorEarnings, queryReport, type DoctorEarningsRow } from "@/lib/data/admin";
import { queryBookings } from "@/lib/data/bookings";
import { queryDayStatus, setDayStatus as saveDayStatus } from "@/lib/data/scheduling";
import { queryQueue, type QueueBoard } from "@/lib/data/queue";
import { queryConsultations, type ConsultationRow } from "@/lib/data/clinical";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

type DayStatus = "Available" | "RunningLate" | "UnavailableToday";
type Range = "month" | "year" | "custom";

const EMPTY_TOTALS = { completed_visits: 0, gross_billed: 0, collected: 0, waived: 0 };
const EMPTY_BOARD: QueueBoard = { date: "", summary: { booked: 0, waiting: 0, in_progress: 0, completed: 0, no_show: 0, total: 0 }, items: [] };

interface ClinicBookingRow {
  id: string;
  patientName: string;
  slotStartTime: string;
  queueNumber: string | null;
  status: string;
}

function elapsedMinutes(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

// Round 2: this page previously went "pure analytics, not a second patient
// queue" (see git history) because a full per-patient Today's Queue table
// mixed with earnings trends made the page unclear about what kind of thing
// it was. This "Right now" strip is deliberately NOT that table — it's a
// glanceable summary + up-to-3 action cards, visually separated from
// Practice Analytics by its own heading and position above the fold, so the
// two jobs ("what needs doing right now" vs "how is my practice doing this
// month") stay legible as two different things instead of one blended list.
export default function DoctorDashboardPage() {
  const { session } = useSession();
  const meDoctorId = session?.staffId ?? "";
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [dayStatus, setDayStatus] = useState<DayStatus>("Available");
  const [earnings, setEarnings] = useState<DoctorEarningsRow[]>([]);
  const [range, setRange] = useState<Range>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customTotals, setCustomTotals] = useState<typeof EMPTY_TOTALS | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);

  const [board, setBoard] = useState<QueueBoard>(EMPTY_BOARD);
  const [consultationsToday, setConsultationsToday] = useState<ConsultationRow[]>([]);
  const [followUpsDueToday, setFollowUpsDueToday] = useState<ConsultationRow[]>([]);

  // Clinic Overview — the same admin-dashboard stats (Admin Dashboard's
  // v_daily_booking_summary/v_unpaid_completed_visits/v_pending_follow_ups
  // reads, ReportsController's StaffReports role already covers "Doctor"),
  // scoped to this doctor's own bookings so a single-doctor clinic doesn't
  // need to switch to an admin login just to see the practice's own numbers.
  const [revenueToday, setRevenueToday] = useState(0);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [onHoldThisMonth, setOnHoldThisMonth] = useState(0);
  const [unpaidCompletedMonth, setUnpaidCompletedMonth] = useState(0);
  const [noShowsToday, setNoShowsToday] = useState(0);
  const [followUpsDue7Days, setFollowUpsDue7Days] = useState(0);
  const [recentBookings, setRecentBookings] = useState<ClinicBookingRow[]>([]);

  const loadClinicOverview = useCallback(async () => {
    if (!meDoctorId) return;
    const supabase = null as never;
    const today = todayManila();
    const monthStart = `${today.slice(0, 7)}-01`;
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    try {
      const [dailySummary, unpaidRes, followUpsRes, monthBookings, recent] = await Promise.all([
        queryReport<Record<string, unknown>>(supabase, "v_daily_booking_summary"),
        queryReport<Record<string, unknown>>(supabase, "v_unpaid_completed_visits").then((rows) =>
          rows.filter((r) => (r.doctor_id as string) === meDoctorId && (r.appointment_date as string) >= monthStart),
        ),
        queryReport<Record<string, unknown>>(supabase, "v_pending_follow_ups").then((rows) =>
          rows.filter(
            (r) =>
              (r.doctor_id as string) === meDoctorId &&
              (r.follow_up_date as string) >= today &&
              (r.follow_up_date as string) <= in7Days,
          ),
        ),
        queryBookings(supabase, { doctorId: meDoctorId, from: monthStart, to: today }),
        queryBookings(supabase, { doctorId: meDoctorId }),
      ]);

      // v_daily_booking_summary has no doctor_id (clinic-wide per day) — fine
      // for a single-doctor clinic, where "the clinic's day" and "this
      // doctor's day" are the same thing.
      const todaySummary = dailySummary.find((r) => r.appointment_date === today) ?? null;
      setRevenueToday(Number(todaySummary?.revenue ?? 0));
      setNoShowsToday(Number(todaySummary?.no_show_count ?? 0));
      setPendingVerifications(monthBookings.filter((b) => b.status === "ProofSubmitted").length);
      setOnHoldThisMonth(monthBookings.filter((b) => b.status === "OnHold").length);
      setUnpaidCompletedMonth(unpaidRes.length);
      setFollowUpsDue7Days(followUpsRes.length);

      setRecentBookings(
        [...recent]
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
          .slice(0, 20)
          .map((b) => ({
            id: b.booking_id,
            patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
            slotStartTime: (b.slot_start_time ?? "").slice(0, 5),
            queueNumber: b.queue_number,
            status: b.status,
          })),
      );
    } catch {
      // Non-critical widget — leave whatever was last loaded rather than
      // blanking the rest of the dashboard over a report-endpoint hiccup.
    }
  }, [meDoctorId]);

  const loadQueue = useCallback(async () => {
    const supabase = null as never;
    try {
      setBoard(await queryQueue(supabase));
    } catch {
      setBoard(EMPTY_BOARD);
    }
  }, []);

  const loadAttention = useCallback(async () => {
    if (!meDoctorId) return;
    const supabase = null as never;
    const today = todayManila();
    try {
      const rows = await queryConsultations(supabase, { doctorId: meDoctorId });
      setConsultationsToday(
        rows.filter(
          (c) => c.bookings?.appointment_date === today && c.status === "Completed" && (!c.assessment?.trim() || !c.plan?.trim()),
        ),
      );
      setFollowUpsDueToday(rows.filter((c) => c.follow_ups?.follow_up_date === today));
    } catch {
      setConsultationsToday([]);
      setFollowUpsDueToday([]);
    }
  }, [meDoctorId]);

  // Same "subscribe, refetch" pattern already used by /doctor/appointments —
  // group membership is server-assigned from the JWT, so this just works.
  useClinicHubEvent("PatientCheckedIn", loadQueue);
  useClinicHubEvent("QueueUpdated", () => {
    loadQueue();
    loadAttention();
  });
  // PaymentUpdated changes amount_due on the queue board (the "unpaid"
  // card below reads board.items), not just the attention lists — missing
  // loadQueue here meant a doctor staring at this page while staff collects
  // payment would keep seeing "Unpaid" until something else refreshed it.
  useClinicHubEvent("PaymentUpdated", () => {
    loadQueue();
    loadAttention();
    loadClinicOverview();
  });
  useClinicHubEvent("PatientCheckedIn", loadClinicOverview);

  // Real-time is the primary trigger; this poll is the fallback for a
  // dropped/blocked SignalR connection (same pattern as /staff/queue), so a
  // stale "unpaid" tag self-corrects within a minute even if push never
  // arrives — matters most in production, where a proxy or a
  // multi-instance backend without a shared backplane can silently break
  // the push path while everything else still works.
  useEffect(() => {
    const t = setInterval(() => {
      loadQueue();
      loadAttention();
      loadClinicOverview();
    }, 60_000);
    return () => clearInterval(t);
  }, [loadQueue, loadAttention, loadClinicOverview]);

  useEffect(() => {
    if (!meDoctorId) return;
    async function load() {
      const supabase = null as never;
      const today = todayManila();
      const statusRow = await queryDayStatus(supabase, meDoctorId, today);
      setName(session?.displayName ?? "");
      setDayStatus((statusRow?.status as DayStatus) ?? "Available");
      try {
        setEarnings(await queryDoctorEarnings(supabase, meDoctorId));
      } catch {
        setEarnings([]);
      }
      await Promise.all([loadQueue(), loadAttention(), loadClinicOverview()]);
      setLoaded(true);
    }
    load();
  }, [meDoctorId, loadQueue, loadAttention, loadClinicOverview, session?.displayName]);

  const currentMonth = todayManila().slice(0, 7); // "YYYY-MM"
  const currentYear = todayManila().slice(0, 4); // "YYYY"

  const monthTotals = useMemo(
    () => earnings.find((e) => e.period === currentMonth) ?? { ...EMPTY_TOTALS, period: currentMonth, doctor_id: meDoctorId },
    [earnings, currentMonth, meDoctorId],
  );
  const yearTotals = useMemo(
    () =>
      earnings
        .filter((e) => e.period.startsWith(currentYear))
        .reduce(
          (acc, e) => ({
            completed_visits: acc.completed_visits + e.completed_visits,
            gross_billed: acc.gross_billed + e.gross_billed,
            collected: acc.collected + e.collected,
            waived: acc.waived + e.waived,
          }),
          EMPTY_TOTALS,
        ),
    [earnings, currentYear],
  );
  // Month/Year read from the pre-aggregated earnings view; Custom needs
  // per-visit data the view doesn't have, so it queries bookings directly
  // for exactly the picked range and sums them client-side.
  useEffect(() => {
    if (range !== "custom" || !meDoctorId || !customFrom || !customTo) return;
    let cancelled = false;
    async function load() {
      setLoadingCustom(true);
      try {
        const supabase = null as never;
        const rows = await queryBookings(supabase, { doctorId: meDoctorId, from: customFrom, to: customTo, status: "Completed" });
        if (cancelled) return;
        setCustomTotals(
          rows.reduce(
            (acc, b) => ({
              completed_visits: acc.completed_visits + 1,
              gross_billed: acc.gross_billed + Number(b.total_fee),
              collected: acc.collected + (b.payments?.status === "Paid" ? Number(b.payments.amount ?? 0) : 0),
              waived: acc.waived + (b.payments?.status === "Waived" ? Number(b.payments.amount ?? 0) : 0),
            }),
            EMPTY_TOTALS,
          ),
        );
      } finally {
        if (!cancelled) setLoadingCustom(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, meDoctorId, customFrom, customTo]);

  const totals = range === "month" ? monthTotals : range === "year" ? yearTotals : (customTotals ?? EMPTY_TOTALS);
  const rangeLabel =
    range === "month"
      ? new Date(`${currentMonth}-01`).toLocaleDateString("en-PH", { month: "long", year: "numeric" })
      : range === "year"
        ? currentYear
        : customFrom && customTo
          ? `${customFrom} to ${customTo}`
          : "Custom range";

  async function setStatus(status: DayStatus) {
    const supabase = null as never;
    const today = todayManila();
    await saveDayStatus(supabase, meDoctorId, today, status);
    setDayStatus(status);
  }

  // Only what the doctor can act on right now — a Confirmed walk-in hasn't
  // checked in yet (nothing to do), Completed/No-show are done. Sorted by
  // queue number so "who's actually next" reads the same as the physical line.
  const upNext = board.items
    .filter((e) => e.status === "CheckedIn" || e.status === "InProgress")
    .sort((a, b) => Number(a.queue_number) - Number(b.queue_number))
    .slice(0, 3);
  const unpaidCompleted = board.items.filter((e) => e.status === "Completed" && Number(e.amount_due) > 0);

  const prevMonth = new Date(`${currentMonth}-01`);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthEntry = earnings.find((e) => e.period === prevMonth.toISOString().slice(0, 7));
  const collectedDelta =
    range === "month" && prevMonthEntry && prevMonthEntry.collected > 0
      ? Math.round(((monthTotals.collected - prevMonthEntry.collected) / prevMonthEntry.collected) * 100)
      : null;

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading your dashboard…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor" roleBadge={<StatusPill status={dayStatus} />}>
      <div className="space-y-lg">
        <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-headline-lg text-on-surface">Good morning, {name}</h2>
            <p className="text-body-md text-on-surface-variant">Shift: 8:00 AM - 5:00 PM</p>
          </div>
          <Link href="/doctor/appointments">
            <Button>
              Go to My Appointments
              <Icon name="chevron_right" className="text-[18px]" />
            </Button>
          </Link>
        </div>

        <Card className="!p-md">
          <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
            <h3 className="text-label-lg font-semibold text-on-surface">Right now</h3>
            <div className="flex flex-wrap gap-sm text-label-sm text-on-surface-variant">
              <span>{board.summary.waiting} waiting</span>
              <span>{board.summary.in_progress} in progress</span>
              <span>{board.summary.completed} completed today</span>
            </div>
          </div>

          {upNext.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">
              {board.summary.total === 0 ? "No one's checked in yet today." : `Queue's clear — ${board.summary.completed} seen today.`}
            </p>
          ) : (
            <div className="space-y-xs">
              {upNext.map((e) => (
                <div
                  key={e.booking_id}
                  className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-outline-variant px-sm py-xs"
                >
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      Q#{e.queue_number} · {e.patient_name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {e.visit_type === "FollowUp" ? "Follow-up" : "New"}
                      {e.status === "CheckedIn" ? ` · Waiting ${elapsedMinutes(e.checked_in_at)}m` : " · In progress"}
                    </p>
                  </div>
                  <Link href={`/doctor/consultation/${e.booking_id}`}>
                    <Button className="!px-sm !py-xs text-label-sm">
                      {e.status === "InProgress" ? "Resume Consultation" : "Start Consultation"}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {(unpaidCompleted.length > 0 || consultationsToday.length > 0 || followUpsDueToday.length > 0) && (
            <div className="mt-sm space-y-xs border-t border-outline-variant/30 pt-sm">
              <p className="text-label-sm font-semibold text-on-surface-variant">Needs attention</p>
              {unpaidCompleted.slice(0, 5).map((e) => (
                <Link
                  key={`unpaid-${e.booking_id}`}
                  href="/staff/payments"
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-sm py-xs hover:bg-surface-container-low"
                >
                  <span className="text-body-sm text-on-surface">{e.patient_name} — completed, unpaid</span>
                  <span className="text-label-sm text-on-surface-variant">₱{e.amount_due} due</span>
                </Link>
              ))}
              {consultationsToday.slice(0, 5).map((c) => (
                <Link
                  key={`incomplete-${c.consultation_id}`}
                  href={`/doctor/consultation/${c.booking_id}?mode=amend`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-sm py-xs hover:bg-surface-container-low"
                >
                  <span className="text-body-sm text-on-surface">Chart missing Assessment/Plan</span>
                  <span className="text-label-sm text-on-surface-variant">Finish chart</span>
                </Link>
              ))}
              {followUpsDueToday.slice(0, 5).map((c) => (
                <Link
                  key={`followup-${c.consultation_id}`}
                  href={`/doctor/consultation/${c.booking_id}?mode=view`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-sm py-xs hover:bg-surface-container-low"
                >
                  <span className="text-body-sm text-on-surface">Follow-up due today</span>
                  <span className="text-label-sm text-on-surface-variant">View chart</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="!p-md">
          <h3 className="mb-sm text-label-lg font-semibold text-on-surface">Availability</h3>
          <p className="mb-sm text-label-md text-on-surface-variant">
            {board.summary.waiting > 0
              ? `${board.summary.waiting} waiting${
                  upNext[0]?.status === "CheckedIn" ? ` · longest wait ${elapsedMinutes(upNext[0].checked_in_at)}m` : ""
                }`
              : "No one waiting right now."}
          </p>
          <div className="flex flex-wrap gap-sm">
            <Button variant={dayStatus === "Available" ? "primary" : "secondary"} onClick={() => setStatus("Available")}>Available</Button>
            <Button variant={dayStatus === "RunningLate" ? "primary" : "secondary"} onClick={() => setStatus("RunningLate")}>Running Late</Button>
            <Button variant={dayStatus === "UnavailableToday" ? "primary" : "secondary"} onClick={() => setStatus("UnavailableToday")}>Unavailable Today</Button>
          </div>
        </Card>

        {/* Clinic Overview — the Admin Dashboard's own stat cards + recent
            bookings, surfaced here too so a solo doctor running the clinic
            doesn't need a separate admin login just to see these. */}
        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Clinic Overview</h3>
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 md:grid-cols-3">
            <StatCard icon="payments" value={peso(revenueToday)} label="Revenue Today" />
            <StatCard icon="event_busy" value={noShowsToday} label="No Shows Today" />
            <StatCard icon="pending_actions" value={pendingVerifications} label="Pending Verifications (month)" />
            <StatCard icon="hourglass_top" value={onHoldThisMonth} label="On Hold (month)" />
            <StatCard icon="receipt_long" value={unpaidCompletedMonth} label="Unpaid Completed (month)" />
            <StatCard icon="follow_the_signs" value={followUpsDue7Days} label="Follow-Ups Due in 7 Days" />
          </div>

          <div className="mt-lg border-t border-outline-variant/30 pt-lg">
            <h4 className="mb-sm text-label-lg font-semibold text-on-surface">Recent Bookings</h4>
            <DataTable
              columns={[
                { header: "Patient", render: (r) => r.patientName },
                { header: "Time", render: (r) => r.slotStartTime },
                { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
                { header: "Status", render: (r) => <StatusPill status={r.status} /> },
              ]}
              rows={recentBookings}
              rowKey={(r) => r.id}
              rowHref={(r) => `/doctor/appointments/${r.id}`}
              emptyMessage="No bookings yet."
              renderMobileCard={(r) => (
                <div className="space-y-xs">
                  <div className="flex items-center justify-between gap-md">
                    <p className="text-body-md font-medium text-on-surface">{r.patientName}</p>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-label-sm text-on-surface-variant">
                    {r.slotStartTime} · Q#{r.queueNumber ?? "—"}
                  </p>
                </div>
              )}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-md flex flex-wrap items-center justify-between gap-md">
            <h3 className="text-headline-sm text-on-surface">Practice Analytics — {rangeLabel}</h3>
            <div className="flex gap-xs">
              <Button variant={range === "month" ? "primary" : "secondary"} onClick={() => setRange("month")}>
                This Month
              </Button>
              <Button variant={range === "year" ? "primary" : "secondary"} onClick={() => setRange("year")}>
                This Year
              </Button>
              <Button variant={range === "custom" ? "primary" : "secondary"} onClick={() => setRange("custom")}>
                Custom Range
              </Button>
            </div>
          </div>

          {range === "custom" && (
            <div className="mb-md flex flex-wrap items-center gap-sm">
              <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="From" />
              <span className="text-label-md text-on-surface-variant">to</span>
              <DatePicker value={customTo} onChange={setCustomTo} placeholder="To" minDate={customFrom || undefined} />
            </div>
          )}

          {range === "custom" && (!customFrom || !customTo) ? (
            <p className="text-body-md text-on-surface-variant">Pick a start and end date to see totals for that range.</p>
          ) : range === "custom" && loadingCustom ? (
            <p className="text-body-md text-on-surface-variant">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
              <div>
                <p className="text-headline-lg text-on-surface">{totals.completed_visits}</p>
                <p className="text-label-md text-on-surface-variant">Appointments</p>
              </div>
              <div>
                <p className="text-headline-lg text-on-surface">{peso(totals.collected)}</p>
                <p className="text-label-md text-on-surface-variant">
                  Collected
                  {collectedDelta !== null && (
                    <span className={collectedDelta >= 0 ? " text-green-700" : " text-red-700"}>
                      {" "}
                      ({collectedDelta >= 0 ? "+" : ""}
                      {collectedDelta}% vs last month)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-headline-lg text-on-surface">{peso(totals.waived)}</p>
                <p className="text-label-md text-on-surface-variant">Waived</p>
              </div>
            </div>
          )}

          {range !== "custom" && earnings.length === 0 && (
            <p className="mt-md text-body-md text-on-surface-variant">No completed appointments yet.</p>
          )}

          {range !== "custom" && earnings.length > 1 && (
            <div className="mt-lg overflow-x-auto border-t border-outline-variant/30 pt-md">
              <p className="mb-sm text-label-md uppercase tracking-wide text-on-surface-variant">Monthly trend</p>
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="text-left text-label-md text-on-surface-variant">
                    <th className="py-xs pr-md">Month</th>
                    <th className="py-xs pr-md text-right">Appointments</th>
                    <th className="py-xs text-right">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {earnings.map((e) => (
                    <tr key={e.period}>
                      <td className="py-xs pr-md">{e.period}</td>
                      <td className="py-xs pr-md text-right">{e.completed_visits}</td>
                      <td className="py-xs text-right">{peso(e.collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
    </AppShell>
  );
}
