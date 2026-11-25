"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { addDaysToDate, previousMonth, todayManila } from "@/lib/clock";
import { useCallback, useEffect, useMemo, useRef, useState } from "react"; //JJQR - AI (Nov 25, 2026) - code review: useRef for the Mark received double-click guard //JJQR - END
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
import { LeftoverQueue, type EarlierAttention } from "@/components/queue/LeftoverQueue"; //JJQR - AI (2026-11-25) - why: GAV-4 leftover patients //JJQR - END
import { queryConsultations, type ConsultationRow } from "@/lib/data/clinical";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";
import { compareQueueNumbers, isPriorityQueueNumber } from "@/lib/queue-lane"; //JJQR - AI (Nov 21, 2026) - priority lane
import { ATTENTION_GROUP_MAX_ROWS, attentionFrom, groupAttention, itemsLabel, MARK_RECEIVED_DETAIL, markReceivedQuestion, pesoLabel, type AttentionEntry } from "@/lib/attention-groups"; //JJQR - AI (Nov 25, 2026) - GAV-2 Needs attention by date
//JJQR - AI (Nov 25, 2026) - doctor "Mark received"
import { Modal } from "@/components/ui/Modal";
import { markReceivedByDoctor } from "@/lib/data/payments";
import { ApiError } from "@/lib/api/client";
import { MARK_RECEIVED_GENERIC, markReceivedErrorText } from "@/lib/attention-groups";
//JJQR - END

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
  //JJQR - AI (Nov 25, 2026) - GAV-2: charts left blank on an earlier day stay listed under their date (was today only)
  const [chartsToFinish, setChartsToFinish] = useState<ConsultationRow[]>([]);
  // unpaid completed visits from earlier days (today's come from the queue board), and names for those days
  const [unpaidOlder, setUnpaidOlder] = useState<{ booking_id: string; patient_name: string; appointment_date: string; amount_due: number }[]>([]);
  const [bookingNames, setBookingNames] = useState<Record<string, string>>({});
  //JJQR - AI (2026-11-26) - why: the date headers moved to the "Earlier days" card (LeftoverQueue keeps its own open / closed state) //JJQR - END
  //JJQR - AI (Nov 25, 2026) - doctor "Mark received" on a completed, unpaid row: the row being confirmed, saving flag (stops a double tap),
  // the confirm box's error, rows already marked (hidden at once, before the refresh lands) and the "marked received" note
  const [receiveTarget, setReceiveTarget] = useState<{ bookingId: string; name: string; amount: number } | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState("");
  const [receivedIds, setReceivedIds] = useState<string[]>([]);
  const [receivedNote, setReceivedNote] = useState("");
  const receivingRef = useRef(false); // code review: same-tick double-click guard (state updates land only after a re-render)
  //JJQR - END
  //JJQR - END
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
      const unpaidOlderRows = queryReport<Record<string, unknown>>(supabase, "v_unpaid_completed_visits"); //JJQR - AI (Nov 25, 2026) - one fetch, also used for the older Needs attention dates //JJQR - END
      const [unpaidRes, followUpsRes, recent] = await Promise.all([
        unpaidOlderRows.then((rows) => //JJQR - AI (Nov 25, 2026) - GAV-2: reuses the one report fetch above //JJQR - END
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
      //JJQR - AI (Nov 25, 2026) - GAV-2: earlier days' unpaid visits stay in Needs attention under their date (same report, last ATTENTION_DAYS_BACK days)
      const attentionStart = attentionFrom(today);
      setUnpaidOlder(
          (await unpaidOlderRows)
            .filter((r) => (r.doctor_id as string) === meDoctorId && (r.appointment_date as string) >= attentionStart && (r.appointment_date as string) < today)
            .map((r) => ({
              booking_id: r.booking_id as string,
              patient_name: (r.patient_name as string) ?? "",
              appointment_date: r.appointment_date as string,
              amount_due: Number(r.amount_due) || 0,
            }))
            .filter((r) => r.amount_due > 0), //JJQR - AI (Nov 25, 2026) - code review: like today's rows, nothing due = not listed (no "₱0 due") //JJQR - END
      );
      setBookingNames(Object.fromEntries(recent.filter((b) => b.patients).map((b) => [b.booking_id, `${b.patients!.first_name} ${b.patients!.last_name}`])));
      //JJQR - END

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
      //JJQR - AI (Nov 25, 2026) - GAV-2: also earlier days (last ATTENTION_DAYS_BACK days), shown under their own date
      const from = attentionFrom(today);
      //JJQR - END
      setChartsToFinish( //JJQR - AI (Nov 25, 2026) - GAV-2: was consultationsToday (today only); now the last ATTENTION_DAYS_BACK days //JJQR - END
        rows.filter(
          //JJQR - AI (Nov 20, 2026) - Complete does not require Assessment/Plan, so only flag a chart where BOTH are blank (one filled in is a finished chart)
          (c) => (c.bookings?.appointment_date ?? "") >= from && (c.bookings?.appointment_date ?? "") <= today && c.status === "Completed" && !c.assessment?.trim() && !c.plan?.trim(),
          //JJQR - END
        ),
      );
      //JJQR - AI (Nov 20, 2026) - PRN follow-ups are saved with today's date; they are not "due today"
      setFollowUpsDueToday(rows.filter((c) => c.follow_ups?.follow_up_date === today && !isPrnFollowUp(c.follow_ups)));
      //JJQR - END
    } catch {
      setChartsToFinish([]); //JJQR - AI (Nov 25, 2026) - GAV-2 rename //JJQR - END
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
  const attentionName = (bookingId: string) => patientNameByBooking.get(bookingId)?.trim() || bookingNames[bookingId]?.trim() || "A patient";
  //JJQR - AI (Nov 25, 2026) - GAV-2 (approved mockup): one list, grouped by visit date; today first and open, older dates collapsible
  const attentionToday = todayManila();
  //JJQR - AI (Nov 25, 2026) - doctor "Mark received": one save at a time; the box closes only after the server said yes; a refusal (amount changed,
  // waived, already recorded, offline) is shown in the box in plain words and the row stays
  const confirmReceived = async () => {
    const target = receiveTarget;
    if (!target || receiving || receivingRef.current) return;
    receivingRef.current = true; //JJQR - AI (Nov 25, 2026) - code review: a second click before React re-renders must not send a second request //JJQR - END
    setReceiving(true);
    setReceiveError("");
    try {
      await markReceivedByDoctor(target.bookingId, target.amount);
      setReceivedIds((ids) => [...ids, target.bookingId]);
      setReceiveTarget(null);
      setReceivedNote(`${pesoLabel(target.amount)} from ${target.name} marked received.`);
      void loadQueue();
      void loadClinicOverview();
    } catch (e) {
      //JJQR - AI (Nov 25, 2026) - code review: an old server (no endpoint) or a 403 came back as "Not Found"/"Forbidden"; say it in plain words
      setReceiveError(e instanceof ApiError ? markReceivedErrorText(e.status, e.body) : MARK_RECEIVED_GENERIC);
      //JJQR - END
      void loadQueue();
      void loadClinicOverview();
    } finally {
      receivingRef.current = false; //JJQR - AI (Nov 25, 2026) - code review //JJQR - END
      setReceiving(false);
    }
  };
  //JJQR - END
  const attentionEntries: AttentionEntry[] = [
    ...unpaidCompleted.map((e) => ({ booking_id: e.booking_id, patient_name: e.patient_name, appointment_date: attentionToday, amount_due: Number(e.amount_due) })),
    ...unpaidOlder,
  ].map((u) => ({
    key: `unpaid-${u.booking_id}`,
    kind: "unpaid" as const,
    date: u.appointment_date,
    name: u.patient_name?.trim() || attentionName(u.booking_id),
    what: `${pesoLabel(u.amount_due)} due`, //JJQR - AI (Nov 25, 2026) - the row's action is now "Mark received" //JJQR - END
    note: "Completed, unpaid",
    action: "Mark received",
    href: `/doctor/appointments/${u.booking_id}`,
    amount: u.amount_due,
  }))
    .filter((e) => !receivedIds.includes(e.key.slice("unpaid-".length))); //JJQR - AI (Nov 25, 2026) - a row marked received disappears at once //JJQR - END
  for (const c of chartsToFinish)
    attentionEntries.push({
      key: `chart-${c.consultation_id}`,
      kind: "chart",
      date: c.bookings?.appointment_date ?? "",
      name: attentionName(c.booking_id),
      what: "Finish chart: Assessment and Plan are blank",
      note: "Completed visit",
      action: "Finish chart",
      href: `/doctor/consultation2/${c.booking_id}?mode=amend`,
    });
  for (const c of followUpsDueToday)
    attentionEntries.push({
      key: `followup-${c.consultation_id}`,
      kind: "followup",
      date: attentionToday,
      name: attentionName(c.booking_id),
      what: "Follow-up due today",
      note: c.follow_ups?.reason?.trim() ?? "",
      action: "View chart",
      href: `/doctor/consultation2/${c.booking_id}?mode=view`,
    });
  const attentionGroups = groupAttention(attentionEntries, attentionToday);
  //JJQR - AI (2026-11-26) - why: owner (t79u): today's Needs attention stays in today's card; each earlier date's Needs attention moves under that date
  // in the "Earlier days" card (with that day's queue). Same rows and actions as before, rendered by one function for both places.
  const todayAttention = attentionGroups.find((g) => g.isToday);
  const renderAttentionRows = (items: AttentionEntry[]) => (
    <div>
      {items.slice(0, ATTENTION_GROUP_MAX_ROWS).map((it) => (
        <div key={it.key} className="flex flex-wrap items-center justify-between gap-sm border-t border-outline-variant/40 px-sm py-xs">
          <div className="min-w-0">
            <p className="text-body-md font-semibold text-on-surface">{it.name}</p>
            <p className="text-body-sm text-on-surface">{it.what}</p>
            {it.note && <p className="text-label-sm text-on-surface-variant">{it.note}</p>}
          </div>
          {/*JJQR - AI (Nov 25, 2026) - unpaid: "Mark received" opens a small confirm box (no navigation) */}
          {it.kind === "unpaid" ? (
            <Button
              className="shrink-0"
              disabled={receiving}
              onClick={() => {
                if (receiving) return;
                setReceiveError("");
                setReceiveTarget({ bookingId: it.key.slice("unpaid-".length), name: it.name, amount: it.amount ?? 0 });
              }}
            >
              {it.action}
            </Button>
          ) : (
            <Link href={it.href} className={buttonStyles("secondary", "shrink-0")}>
              {it.action}
            </Link>
          )}
          {/*JJQR - END */}
        </div>
      ))}
      {items.length > ATTENTION_GROUP_MAX_ROWS && (
        <Link href="/doctor/appointments" className="block border-t border-outline-variant/40 px-sm py-xs text-label-md font-semibold text-primary hover:underline">
          +{items.length - ATTENTION_GROUP_MAX_ROWS} more — view all
        </Link>
      )}
      </div>
  );
  const earlierAttention: EarlierAttention[] = attentionGroups
    .filter((g) => !g.isToday)
    .map((g) => ({ date: g.date, count: g.items.length, render: () => renderAttentionRows(g.items) }));
  //JJQR - END
  //JJQR - END
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
      {/*JJQR - AI (Nov 22, 2026) - two columns like the desktop: queue + reports on the left, availability / analytics / clinic hours on the right */}
      <div className="grid min-w-0 gap-lg overflow-x-hidden xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <div className="xl:col-span-2"><DoctorPageHeader title="Your clinic today" description={<>{name} · <span className="tabular-nums">{visitDate(todayManila())}</span></>} actions={<>{/*JJQR - AI (Nov 19, 2026) */}<Link href="/doctor/performance" data-testid="performance-link" className={buttonStyles("secondary")}><Icon name="monitoring" className="h-4 w-4" />Your performance</Link>{/*JJQR - END */}<Link href="/doctor/appointments" className={buttonStyles("primary")}>Open appointments<Icon name="arrow_forward" className="h-4 w-4" /></Link></>} /></div>
        {statusError && <Toast variant="error" key={statusError} message={statusError} />}
        {/*JJQR - AI (Nov 25, 2026) - doctor "Mark received" result */}
        {receivedNote && <Toast variant="success" key={receivedNote} message={receivedNote} />}
        {/*JJQR - END */}

        {/*JJQR - AI (2026-11-26) - why: today's card and the separate "Earlier days" card stack in the left column (the wrapper takes the old row-span) */}
        <div className="flex min-w-0 flex-col gap-lg xl:col-start-1 xl:row-span-4">
        {/*JJQR - END */}
        <Card className="!p-md sm:!p-lg">
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

          {/*JJQR - AI (2026-11-26) - why: owner (t78u/t79u) "yesterday's queue should not cross over TODAY's". This card shows TODAY only: today's queue
              above and today's Needs attention below (flat list). Earlier days (their unfinished queue + their Needs attention) are in the separate
              "Earlier days" card under this one, one group per date. */}
          {todayAttention && todayAttention.items.length > 0 && (
            <div className="mt-sm space-y-xs border-t border-outline-variant/30 pt-sm" data-testid="today-attention">
              <div className="flex items-center justify-between gap-sm">
                <p className="text-label-sm font-semibold text-on-surface-variant">Needs attention · Today</p>
                <span className="rounded-full border border-status-warning-border bg-status-warning-surface px-sm text-label-sm font-semibold text-status-warning">
                  {itemsLabel(todayAttention.items.length)}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-outline-variant/60 [&>div>div:first-child]:border-t-0">
                {renderAttentionRows(todayAttention.items)}
              </div>
            </div>
          )}
          {/*JJQR - END */}
          {/*JJQR - AI (Nov 25, 2026) - doctor "Mark received" confirm box (Cancel / Mark received) */}
          <Modal
            isOpen={receiveTarget !== null}
            onClose={() => {
              if (!receiving) setReceiveTarget(null);
            }}
            title={receiveTarget ? markReceivedQuestion(receiveTarget.amount) : "Mark received?"}
            footer={
              <>
                <Button variant="secondary" disabled={receiving} onClick={() => setReceiveTarget(null)}>
                  Cancel
                </Button>
                <Button loading={receiving} disabled={receiving} onClick={() => void confirmReceived()}>
                  Mark received
                </Button>
              </>
            }
          >
            <p className="text-body-md text-on-surface">{receiveTarget?.name}</p>
            <p className="mt-xs text-body-sm text-on-surface-variant">{MARK_RECEIVED_DETAIL}</p>
            {receiveError && (
              <p role="alert" className="mt-sm text-body-sm text-error">
                {receiveError}
              </p>
            )}
          </Modal>
          {/*JJQR - END */}
        </Card>
        {/*JJQR - AI (2026-11-26) - why: owner (t79u) "UNDER NOVEMBER 25 → Queue → list, → Needs attention → list": earlier days in their own card, below today's */}
        <LeftoverQueue role="doctor" onChanged={() => { void loadQueue(); }} attention={earlierAttention} />
        </div>
        {/*JJQR - END */}

        <Card className="!p-md xl:col-start-2">
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
        <details className="rounded-lg border border-outline-variant bg-surface-container-lowest p-md xl:col-start-1">
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

        <Card className="xl:col-start-2">
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

        <Card className="xl:col-start-2">
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
