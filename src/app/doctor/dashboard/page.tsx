"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { addDaysToDate, previousMonth, todayManila } from "@/lib/clock";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { visitDate } from "@/components/doctor/appointments/model";
//JJQR - AI (Nov 20, 2026)
import { isPrnFollowUp } from "@/lib/pf-default";
//JJQR - END
import { Toast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";
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
import { compareQueueNumbers, isPriorityQueueNumber } from "@/lib/queue-lane"; //JJQR - AI (Nov 21, 2026) - priority lane

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
  const [queueError, setQueueError] = useState(false);
  const [overviewError, setOverviewError] = useState(false);
  const [earningsError, setEarningsError] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSaving, setStatusSaving] = useState<DayStatus | null>(null);
  const [name, setName] = useState("");
  //JJQR - AI (Nov 19, 2026) - null = unknown (still loading or the availability call failed): never show "Available" as if it were set
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  //JJQR - END
  const [earnings, setEarnings] = useState<DoctorEarningsRow[]>([]);
  const [range, setRange] = useState<Range>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customTotals, setCustomTotals] = useState<typeof EMPTY_TOTALS | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState(false);

  const [board, setBoard] = useState<QueueBoard>(EMPTY_BOARD);
  const [consultationsToday, setConsultationsToday] = useState<ConsultationRow[]>([]);
  const [followUpsDueToday, setFollowUpsDueToday] = useState<ConsultationRow[]>([]);

  // Clinic Overview — the same admin-dashboard stats (Admin Dashboard's
  // v_unpaid_completed_visits/v_pending_follow_ups
  // reads, ReportsController's StaffReports role already covers "Doctor"),
  // scoped to this doctor's own bookings so a single-doctor clinic doesn't
  // need to switch to an admin login just to see the practice's own numbers.
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [onHoldThisMonth, setOnHoldThisMonth] = useState(0);
  const [unpaidCompletedMonth, setUnpaidCompletedMonth] = useState(0);
  const [followUpsDue7Days, setFollowUpsDue7Days] = useState(0);
  const [recentBookings, setRecentBookings] = useState<ClinicBookingRow[]>([]);

  const loadClinicOverview = useCallback(async () => {
    if (!meDoctorId) return;
    const supabase = null as never;
    const today = todayManila();
    const monthStart = `${today.slice(0, 7)}-01`;
    const in7Days = addDaysToDate(today, 7);
    // One bounded bookings fetch covers both the month counters and the
    // "recent" list — an unbounded doctor-wide fetch grew with every visit
    // ever recorded just to show 20 rows.
    const windowStart = [monthStart, addDaysToDate(today, -31)].sort()[0];
    try {
      const [unpaidRes, followUpsRes, recent] = await Promise.all([
        queryReport<Record<string, unknown>>(supabase, "v_unpaid_completed_visits").then((rows) =>
          rows.filter((r) => (r.doctor_id as string) === meDoctorId && (r.appointment_date as string) >= monthStart),
        ),
        queryReport<Record<string, unknown>>(supabase, "v_pending_follow_ups").then((rows) =>
          rows.filter(
            (r) =>
              (r.doctor_id as string) === meDoctorId &&
              (r.follow_up_date as string) >= today &&
              (r.follow_up_date as string) <= in7Days &&
              //JJQR - AI (Nov 20, 2026) - a PRN follow-up is stored with today's date but is not a scheduled return
              !isPrnFollowUp({ reason: r.reason as string | null }),
              //JJQR - END
          ),
        ),
        queryBookings(supabase, { doctorId: meDoctorId, from: windowStart }),
      ]);
      const monthBookings = recent.filter((b) => b.appointment_date >= monthStart && b.appointment_date <= today);

      //JJQR - AI (Nov 19, 2026) - "Revenue Today" / "No Shows Today" were clinic-wide numbers (the daily summary view has no doctor id), which misled a doctor about their own day. Your own numbers now live on /doctor/performance.
      //JJQR - END
      setOverviewError(false);
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
      setOverviewError(true);
      // Non-critical widget — leave whatever was last loaded rather than
      // blanking the rest of the dashboard over a report-endpoint hiccup.
    }
  }, [meDoctorId]);

  const loadQueue = useCallback(async () => {
    const supabase = null as never;
    try {
      setBoard(await queryQueue(supabase));
      setQueueError(false);
    } catch {
      setQueueError(true);
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
          //JJQR - AI (Nov 20, 2026) - Complete does not require Assessment/Plan, so only flag a chart where BOTH are blank (one filled in is a finished chart)
          (c) => c.bookings?.appointment_date === today && c.status === "Completed" && !c.assessment?.trim() && !c.plan?.trim(),
          //JJQR - END
        ),
      );
      //JJQR - AI (Nov 20, 2026) - PRN follow-ups are saved with today's date; they are not "due today"
      setFollowUpsDueToday(rows.filter((c) => c.follow_ups?.follow_up_date === today && !isPrnFollowUp(c.follow_ups)));
      //JJQR - END
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

  //JJQR - AI (Nov 19, 2026)
  const loadDayStatus = useCallback(async () => {
    setStatusError("");
    try {
      const statusRow = await queryDayStatus(null as never, meDoctorId, todayManila());
      // No row saved for today = the doctor never changed it = Available by default.
      setDayStatus((statusRow?.status as DayStatus) ?? "Available");
    } catch {
      setDayStatus(null);
      setStatusError("Your availability could not be loaded. Check it before changing your status.");
    }
  }, [meDoctorId]);
  //JJQR - END

  useEffect(() => {
    if (!meDoctorId) return;
    async function load() {
      const supabase = null as never;
      const today = todayManila();
      setName(session?.displayName ?? "");
      // All independent — fire together instead of day-status → earnings →
      // the rest, which stacked three full round trips before first paint.
      await Promise.all([
        loadDayStatus(),
        queryDoctorEarnings(supabase, meDoctorId).then(rows => { setEarnings(rows); setEarningsError(false); }, () => setEarningsError(true)),
        loadQueue(),
        loadAttention(),
        loadClinicOverview(),
      ]);
      setLoaded(true);
    }
    load();
  }, [meDoctorId, loadDayStatus, loadQueue, loadAttention, loadClinicOverview, session?.displayName]);

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
      setCustomError(false);
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
      } catch {
        if (!cancelled) setCustomError(true);
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
      ? new Date(`${currentMonth}-01`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" })
      : range === "year"
        ? currentYear
        : customFrom && customTo
          ? `${customFrom} to ${customTo}`
          : "Custom range";

  async function setStatus(status: DayStatus) {
    const supabase = null as never;
    const today = todayManila();
    if (statusSaving) return;
    setStatusSaving(status); setStatusError("");
    try { await saveDayStatus(supabase, meDoctorId, today, status); setDayStatus(status); }
    catch { setStatusError("Your availability could not be updated. Please try again."); }
    finally { setStatusSaving(null); }
  }

  // Only what the doctor can act on right now — a Confirmed walk-in hasn't
  // checked in yet (nothing to do), Completed/No-show are done. Sorted by
  // queue number so "who's actually next" reads the same as the physical line.
  const upNext = board.items
    .filter((e) => e.status === "CheckedIn" || e.status === "InProgress")
    //JJQR - AI (Nov 21, 2026) - seniors / PWD (S-) first, then arrival order inside each lane
    // someone already with the doctor stays on top (a senior who arrives later never bumps them), then the priority lane, then arrival order
    .sort((a, b) => Number(b.status === "InProgress") - Number(a.status === "InProgress") || compareQueueNumbers(a.queue_number, b.queue_number))
    //JJQR - END
    .slice(0, 3);
  const unpaidCompleted = board.items.filter((e) => e.status === "Completed" && Number(e.amount_due) > 0);
  //JJQR - AI (Nov 20, 2026) - the consultation list has no patient names; the queue board does, keyed by booking, so every "Needs attention" row can say WHO
  const patientNameByBooking = new Map(board.items.map((e) => [e.booking_id, e.patient_name]));
  const attentionName = (bookingId: string) => patientNameByBooking.get(bookingId)?.trim() || "A patient";
  //JJQR - END

  const prevMonthEntry = earnings.find((e) => e.period === previousMonth(currentMonth));
  const collectedDelta =
    range === "month" && prevMonthEntry && prevMonthEntry.collected > 0
      ? Math.round(((monthTotals.collected - prevMonthEntry.collected) / prevMonthEntry.collected) * 100)
      : null;

  // doctor@clinic.test (and other identity-only seeds) can authenticate with
  // role Doctor but have no staff_accounts row, so staffId stays null and the
  // data load never runs. Show that instead of an infinite "Loading…".
  if (session && !session.staffId) {
    return (
      <AppShell role="doctor">
        <div className="space-y-sm">
          <p className="text-title-md text-on-surface">No doctor profile linked</p>
          <p className="text-body-md text-on-surface-variant">
            This login can sign in as Doctor but has no staff profile on the server, so the
            dashboard cannot load. Ask your clinic administrator to link your account to a doctor profile.
          </p>
        </div>
      </AppShell>
    );
  }

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <SkeletonCard lines={5} />
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor" roleBadge={dayStatus ? <StatusPill status={dayStatus} /> : undefined}>
      <div className="min-w-0 space-y-lg overflow-x-hidden">
        <DoctorPageHeader title="Your clinic today" description={<>{name} · <span className="tabular-nums">{visitDate(todayManila())}</span></>} actions={<>{/*JJQR - AI (Nov 19, 2026) */}<Link href="/doctor/performance" data-testid="performance-link" className={buttonStyles("secondary")}><Icon name="monitoring" className="h-4 w-4" />Your performance</Link>{/*JJQR - END */}<Link href="/doctor/appointments" className={buttonStyles("primary")}>Open appointments<Icon name="arrow_forward" className="h-4 w-4" /></Link></>} />
        {statusError && <Toast variant="error" key={statusError} message={statusError} />}

        <Card className="!p-lg sm:!p-xl">
          <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
            <h3 className="text-label-lg font-semibold text-on-surface">Your patient queue</h3>
            <div className="flex flex-wrap gap-sm text-label-sm text-on-surface-variant">
              <span>{queueError ? "—" : board.summary.waiting} waiting</span>
              <span>{queueError ? "—" : board.summary.in_progress} in progress</span>
              <span>{queueError ? "—" : board.summary.completed} completed today</span>
            </div>
          </div>

          {queueError ? <div role="alert" className="space-y-md"><p className="text-body-md text-on-surface-variant">Your queue is unavailable. No waiting-patient totals are shown.</p><Button variant="secondary" onClick={loadQueue}>Reload queue</Button></div> : upNext.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">
              {board.summary.total === 0 ? "No one's checked in yet today." : `Queue's clear — ${board.summary.completed} seen today.`}
            </p>
          ) : (
            <div className="space-y-md">
              {upNext.map((e) => (
                <div
                  key={e.booking_id}
                  className="flex flex-wrap items-center justify-between gap-md rounded-lg border border-outline-variant p-md"
                >
                  <div>
                    <p className="text-body-lg font-semibold tabular-nums text-on-surface">
                      Queue {e.queue_number} · {e.patient_name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {e.visit_type === "FollowUp" ? "Follow-up" : "New"}
                      {isPriorityQueueNumber(e.queue_number) ? " · Priority (Senior/PWD)" : ""}
                      {e.status === "CheckedIn" ? ` · Waiting ${elapsedMinutes(e.checked_in_at)}m` : " · In progress"}
                    </p>
                  </div>
                  {/* JJQR - AI (Oct 31, 2026) */}
                  <Link href={`/doctor/consultation2/${e.booking_id}`} className={buttonStyles("secondary", "min-h-11 text-label-md")}>
                    {e.status === "InProgress" ? "Resume consultation" : "Start consultation"}
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
                  href={`/doctor/appointments/${e.booking_id}`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-sm py-xs hover:bg-surface-container-low"
                >
                  <span className="text-body-sm text-on-surface">{e.patient_name} — completed, unpaid</span>
                  <span className="text-label-sm text-on-surface-variant">₱{e.amount_due} due</span>
                </Link>
              ))}
              {/* JJQR - AI (Nov 20, 2026) - B-41: say so when the list is cut at 5, and link to the full list */}
              {unpaidCompleted.length > 5 && (
                <Link href="/doctor/appointments" className="block rounded-lg px-sm py-xs text-label-md font-medium text-primary hover:bg-surface-container-low">
                  +{unpaidCompleted.length - 5} more unpaid visits — view all
                </Link>
              )}
              {/* JJQR - END */}
              {consultationsToday.slice(0, 5).map((c) => (
                <Link
                  key={`incomplete-${c.consultation_id}`}
                  href={`/doctor/consultation2/${c.booking_id}?mode=amend`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-sm py-xs hover:bg-surface-container-low"
                >
                  {/*JJQR - AI (Nov 20, 2026) - name the patient */}
                  <span className="text-body-sm text-on-surface">{attentionName(c.booking_id)} — Assessment and Plan are blank</span>
                  {/*JJQR - END */}
                  <span className="text-label-sm text-on-surface-variant">Finish chart</span>
                </Link>
              ))}
              {/*JJQR - AI (Nov 20, 2026) - say so when a list is cut at 5 (same as the unpaid list) */}
              {consultationsToday.length > 5 && (
                <Link href="/doctor/appointments" className="block rounded-lg px-sm py-xs text-label-md font-medium text-primary hover:bg-surface-container-low">
                  +{consultationsToday.length - 5} more charts to finish — view all
                </Link>
              )}
              {/*JJQR - END */}
              {followUpsDueToday.slice(0, 5).map((c) => (
                <Link
                  key={`followup-${c.consultation_id}`}
                  href={`/doctor/consultation2/${c.booking_id}?mode=view`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant px-sm py-xs hover:bg-surface-container-low"
                >
                  {/*JJQR - AI (Nov 20, 2026) - name the patient */}
                  <span className="text-body-sm text-on-surface">{attentionName(c.booking_id)} — follow-up due today</span>
                  {/*JJQR - END */}
                  <span className="text-label-sm text-on-surface-variant">View chart</span>
                </Link>
              ))}
              {/*JJQR - AI (Nov 20, 2026) */}
              {followUpsDueToday.length > 5 && (
                <Link href="/doctor/appointments" className="block rounded-lg px-sm py-xs text-label-md font-medium text-primary hover:bg-surface-container-low">
                  +{followUpsDueToday.length - 5} more follow-ups due — view all
                </Link>
              )}
              {/*JJQR - END */}
            </div>
          )}
        </Card>

        <Card className="!p-md">
          <h3 className="mb-sm text-label-lg font-semibold text-on-surface">Availability</h3>
          <p className="mb-sm text-label-md text-on-surface-variant">
            {queueError ? "Queue information is unavailable." : board.summary.waiting > 0
              ? `${queueError ? "—" : board.summary.waiting} waiting${
                  upNext[0]?.status === "CheckedIn" ? ` · longest wait ${elapsedMinutes(upNext[0].checked_in_at)}m` : ""
                }`
              : "No one waiting right now."}
          </p>
          {/*JJQR - AI (Nov 19, 2026) - availability failed to load: say so, offer Retry, and don't highlight any status */}
          {dayStatus === null && statusError && (
            <p role="alert" data-testid="availability-unknown" className="mb-sm text-label-md text-status-warning">
              Your status for today is unknown — it couldn&apos;t be loaded.{" "}
              <button type="button" onClick={() => void loadDayStatus()} className="font-medium underline">Retry</button>
            </p>
          )}
          {/*JJQR - END */}
          <div className="flex flex-wrap gap-sm">
            <Button variant={dayStatus === "Available" ? "primary" : "secondary"} disabled={!!statusSaving} loading={statusSaving === "Available"} onClick={() => setStatus("Available")}>Available</Button>
            <Button variant={dayStatus === "RunningLate" ? "primary" : "secondary"} disabled={!!statusSaving} loading={statusSaving === "RunningLate"} onClick={() => setStatus("RunningLate")}>Running Late</Button>
            <Button variant={dayStatus === "UnavailableToday" ? "primary" : "secondary"} disabled={!!statusSaving} loading={statusSaving === "UnavailableToday"} onClick={() => setStatus("UnavailableToday")}>Unavailable Today</Button>
          </div>
        </Card>

        {/* Clinic Overview — the Admin Dashboard's own stat cards + recent
            bookings, surfaced here too so a solo doctor running the clinic
            doesn't need a separate admin login just to see these. */}
        <details className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
          <summary className="text-headline-sm font-semibold text-on-surface">Clinic reports & recent bookings</summary>
          {overviewError ? <p role="alert" className="mt-md text-body-md text-on-surface-variant">Reports are unavailable. <button type="button" onClick={loadClinicOverview} className="text-primary underline">Try again</button></p> : <div className="mt-lg space-y-lg">
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 md:grid-cols-3">
            {/*JJQR - AI (Nov 19, 2026) - replaces the clinic-wide "Revenue Today" / "No Shows Today" cards with a link to the doctor's own numbers */}
            <Link href="/doctor/performance" data-testid="performance-link-card" className="block">
              <Card hoverable className="h-full">
                <div className="mb-md flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="monitoring" /></div>
                <p className="text-headline-sm text-on-surface">Your performance</p>
                <p className="text-label-md text-on-surface-variant">Patients, collected and billed, trends</p>
              </Card>
            </Link>
            {/*JJQR - END */}
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
          </div>}
        </details>

        <Card>
          <div className="mb-md flex flex-wrap items-center justify-between gap-md">
            <h3 className="text-headline-sm text-on-surface">Practice Analytics — {rangeLabel}</h3>
            <div className="flex gap-xs">
              <Button aria-pressed={range === "month"} variant={range === "month" ? "primary" : "secondary"} onClick={() => setRange("month")}>
                This Month
              </Button>
              <Button aria-pressed={range === "year"} variant={range === "year" ? "primary" : "secondary"} onClick={() => setRange("year")}>
                This Year
              </Button>
              <Button aria-pressed={range === "custom"} variant={range === "custom" ? "primary" : "secondary"} onClick={() => setRange("custom")}>
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

          {(earningsError || (range === "custom" && customError)) ? <p role="alert" className="text-body-md text-on-surface-variant">Practice totals could not be loaded. No estimated figures are shown.</p> : range === "custom" && (!customFrom || !customTo) ? (
            <p className="text-body-md text-on-surface-variant">Pick a start and end date to see totals for that range.</p>
          ) : range === "custom" && loadingCustom ? (
            <p className="text-body-md text-on-surface-variant">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
              <div>
                <p className="text-headline-lg tabular-nums text-on-surface">{totals.completed_visits}</p>
                <p className="text-label-md text-on-surface-variant">Completed visits</p>
              </div>
              <div>
                <p className="text-headline-lg tabular-nums text-on-surface">{peso(totals.collected)}</p>
                <p className="text-label-md text-on-surface-variant">
                  Collected
                  {collectedDelta !== null && (
                    <span className={collectedDelta >= 0 ? " text-status-success" : " text-status-danger"}>
                      {" "}
                      ({collectedDelta >= 0 ? "+" : ""}
                      {collectedDelta}% vs last month)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-headline-lg tabular-nums text-on-surface">{peso(totals.waived)}</p>
                <p className="text-label-md text-on-surface-variant">Waived</p>
              </div>
            </div>
          )}

          {!earningsError && range !== "custom" && earnings.length === 0 && (
            <p className="mt-md text-body-md text-on-surface-variant">No completed appointments yet.</p>
          )}

          {!earningsError && range !== "custom" && earnings.length > 1 && (
            <div className="mt-lg overflow-x-auto border-t border-outline-variant/30 pt-md">
              <p className="mb-sm text-label-md uppercase tracking-wide text-on-surface-variant">Monthly trend</p>
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="text-left text-label-md text-on-surface-variant">
                    <th className="py-xs pr-md">Month</th>
                    <th className="py-xs pr-md text-right">Completed visits</th>
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
          <h3 className="mb-md text-headline-sm text-on-surface">Clinic hours & days away</h3>
          <p className="text-body-md text-on-surface-variant">Review your saved weekly hours and blocked dates before changing your availability.</p>
          <Link href="/doctor/schedule" className="mt-sm inline-block text-label-md text-primary hover:underline">
            Manage availability
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
