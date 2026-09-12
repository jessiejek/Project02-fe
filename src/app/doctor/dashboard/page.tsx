"use client";

import Link from "next/link";
import { todayManila } from "@/lib/clock";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DatePicker } from "@/components/ui/DatePicker";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctorEarnings, type DoctorEarningsRow } from "@/lib/data/admin";
import { queryBookings } from "@/lib/data/bookings";
import { queryDayStatus, setDayStatus as saveDayStatus } from "@/lib/data/scheduling";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

type DayStatus = "Available" | "RunningLate" | "UnavailableToday";
type Range = "month" | "year" | "custom";

const EMPTY_TOTALS = { completed_visits: 0, gross_billed: 0, collected: 0, waived: 0 };

// Stitch doctor_dashboard — this page is analytics only (visit/billing
// trends by month or year); the per-patient queue lives on its own page.
// Mixing "how is my practice doing this month" with "who's #4 in line right
// now" on one screen was exactly what made the dashboard confusing — a
// doctor glancing at it couldn't tell which kind of thing they were looking
// at. /doctor/appointments already owns the live, per-patient queue.
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
      setLoaded(true);
    }
    load();
  }, [meDoctorId]);

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

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading your dashboard…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor" roleBadge={<StatusPill status={dayStatus} />}>
      <div className="space-y-xl">
        <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-headline-lg text-on-surface">Good morning, {name}</h2>
            <p className="text-body-md text-on-surface-variant">Shift: 8:00 AM - 5:00 PM</p>
          </div>
          {/* The queue lives on its own page — this is the one link out to it. */}
          <Link href="/doctor/appointments">
            <Button>
              Go to My Visits
              <Icon name="chevron_right" className="text-[18px]" />
            </Button>
          </Link>
        </div>

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
                <p className="text-label-md text-on-surface-variant">Visits</p>
              </div>
              <div>
                <p className="text-headline-lg text-on-surface">{peso(totals.collected)}</p>
                <p className="text-label-md text-on-surface-variant">Collected</p>
              </div>
              <div>
                <p className="text-headline-lg text-on-surface">{peso(totals.waived)}</p>
                <p className="text-label-md text-on-surface-variant">Waived</p>
              </div>
            </div>
          )}

          {range !== "custom" && earnings.length === 0 && (
            <p className="mt-md text-body-md text-on-surface-variant">No completed visits yet.</p>
          )}

          {range !== "custom" && earnings.length > 1 && (
            <div className="mt-lg overflow-x-auto border-t border-outline-variant/30 pt-md">
              <p className="mb-sm text-label-md uppercase tracking-wide text-on-surface-variant">Monthly trend</p>
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="text-left text-label-md text-on-surface-variant">
                    <th className="py-xs pr-md">Month</th>
                    <th className="py-xs pr-md text-right">Visits</th>
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

        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
          <Card>
            <h3 className="mb-md text-headline-sm text-on-surface">Availability</h3>
            <div className="flex flex-wrap gap-sm">
              <Button variant={dayStatus === "Available" ? "primary" : "secondary"} onClick={() => setStatus("Available")}>Available</Button>
              <Button variant={dayStatus === "RunningLate" ? "primary" : "secondary"} onClick={() => setStatus("RunningLate")}>Running Late</Button>
              <Button variant={dayStatus === "UnavailableToday" ? "primary" : "secondary"} onClick={() => setStatus("UnavailableToday")}>Unavailable Today</Button>
            </div>
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
      </div>
    </AppShell>
  );
}
