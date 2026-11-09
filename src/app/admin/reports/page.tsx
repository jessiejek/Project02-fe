"use client";

import { useEffect, useState } from "react";
import { daysFromTodayManila, todayManila } from "@/lib/clock";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { Icon } from "@/components/ui/Icon";
import { formatClinicDateShort, formatPeso } from "@/lib/format";
import { queryReport } from "@/lib/data/admin";

interface UnpaidVisitRow {
  bookingId: string;
  patientName: string;
  doctorName: string;
  visitDate: string;
  amountDue: number;
}

interface PendingFollowUpRow {
  id: string;
  patientName: string;
  doctorName: string;
  reason: string;
  followUpDate: string;
}

interface DailySummaryRow {
  date: string;
  total: number;
  completed: number;
  paid: number;
  unpaid: number;
  noShows: number;
  revenue: number;
}

// Stitch clinical_reports_admin. Export CSV downloads unpaid + daily summary
// for the selected date range.
export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState(daysFromTodayManila(-30));
  const [dateTo, setDateTo] = useState(todayManila());
  const [loading, setLoading] = useState(true);
  const [unpaidCompleted, setUnpaidCompleted] = useState<UnpaidVisitRow[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUpRow[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummaryRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (rangeInvalid) { setLoading(false); return; }
      setLoading(true);
      const supabase = null as never;
      const inRange = (d: string | null | undefined, lo: string, hi: string) => !!d && d >= lo && d <= hi;
      let unpaidAll: Record<string, unknown>[], followUpsAll: Record<string, unknown>[], summaryAll: Record<string, unknown>[];
      try {
      [unpaidAll, followUpsAll, summaryAll] = await Promise.all([
        //JJQR - AI (Oct 31, 2026)
        queryReport<Record<string, unknown>>(supabase, "v_unpaid_completed_visits"),
        queryReport<Record<string, unknown>>(supabase, "v_pending_follow_ups"),
        queryReport<Record<string, unknown>>(supabase, "v_daily_booking_summary"),
        //JJQR - END
      ]);
      } catch {
        if (!cancelled) { setLoadError(true); setLoading(false); }
        return;
      }
      if (cancelled) return;
      setLoadError(false);
      const unpaidRes = { data: unpaidAll.filter((b) => inRange(b.appointment_date as string, dateFrom, dateTo)) };
      const followUpsRes = {
        data: followUpsAll.filter(
          (f) => f.status === "Pending" && inRange(f.follow_up_date as string, dateFrom, dateTo),
        ),
      };
      const summaryRes = {
        data: summaryAll
          .filter((r) => inRange(r.appointment_date as string, dateFrom, dateTo))
          .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date))),
      };

      setUnpaidCompleted(
        (unpaidRes.data ?? [])
          .filter((b) => b.payment_status === "Unpaid")
          .map((b) => ({
            //JJQR - AI (Oct 31, 2026)
            bookingId: String(b.booking_id ?? ""),
            patientName: String(b.patient_name ?? "Unknown Patient"),
            doctorName: String(b.doctor_name ?? "Unknown Doctor"),
            visitDate: String(b.appointment_date ?? ""),
            //JJQR - END
            amountDue: Number(b.amount_due ?? 0),
          })),
      );

      setPendingFollowUps(
        (followUpsRes.data ?? []).map((f) => ({
          //JJQR - AI (Oct 31, 2026)
          id: String(f.follow_up_id ?? ""),
          patientName: String(f.patient_name ?? "Unknown Patient"),
          doctorName: String(f.doctor_name ?? "Unknown Doctor"),
          reason: String(f.reason ?? "Follow-up"),
          followUpDate: String(f.follow_up_date ?? ""),
          //JJQR - END
        })),
      );

      setDailySummary(
        (summaryRes.data ?? []).map((row) => ({
          //JJQR - AI (Oct 31, 2026)
          date: String(row.appointment_date ?? ""),
          //JJQR - END
          total: Number(row.total_bookings ?? 0),
          completed: Number(row.completed_count ?? 0),
          paid: Number(row.paid_count ?? 0),
          unpaid: Number(row.unpaid_count ?? 0),
          noShows: Number(row.no_show_count ?? 0),
          revenue: Number(row.revenue ?? 0),
        })),
      );
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, rangeInvalid, reloadKey]);

  function exportCsv() {
    const escapeCell = (value: string | number | null | undefined) => {
      const raw = value == null ? "" : String(value);
      if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
      return raw;
    };
    const line = (cells: Array<string | number | null | undefined>) => cells.map(escapeCell).join(",");

    const chunks: string[] = [];
    chunks.push("Unpaid Completed Appointments");
    chunks.push(line(["Appointment Date", "Patient", "Doctor", "Amount Due", "Booking ID"]));
    for (const b of unpaidCompleted) {
      chunks.push(line([b.visitDate, b.patientName, b.doctorName, b.amountDue, b.bookingId]));
    }
    chunks.push("");
    chunks.push("Daily Booking Summary");
    chunks.push(line(["Date", "Total", "Completed", "Paid", "Unpaid", "No-Shows", "Revenue"]));
    for (const r of dailySummary) {
      chunks.push(line([r.date, r.total, r.completed, r.paid, r.unpaid, r.noShows, r.revenue]));
    }
    chunks.push("");
    chunks.push("Pending Follow-Ups");
    chunks.push(line(["Follow-up Date", "Patient", "Doctor", "Reason", "Id"]));
    for (const f of pendingFollowUps) {
      chunks.push(line([f.followUpDate, f.patientName, f.doctorName, f.reason, f.id]));
    }

    const blob = new Blob(["\uFEFF" + chunks.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clinic-reports_${dateFrom}_to_${dateTo}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const totals = dailySummary.reduce((t, r) => ({ visits: t.visits + r.total, completed: t.completed + r.completed, noShows: t.noShows + r.noShows, revenue: t.revenue + r.revenue }), { visits: 0, completed: 0, noShows: 0, revenue: 0 });
  const unpaidTotal = unpaidCompleted.reduce((sum, b) => sum + b.amountDue, 0);
  const th = "px-sm py-sm text-label-md font-medium text-on-surface-variant";
  const td = "px-sm py-sm";

  return (
    <AppShell role="admin">
      <div className="space-y-xl">
        <PageHeader
          title="Clinic reports"
          description={<>Revenue, unpaid visits and follow-ups for <span className="tabular-nums">{formatClinicDateShort(dateFrom)} – {formatClinicDateShort(dateTo)}</span>.</>}
          actions={
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={loading || (unpaidCompleted.length === 0 && dailySummary.length === 0 && pendingFollowUps.length === 0)}
            >
              <Icon name="download" className="text-[14px]" />Export CSV
            </Button>
          }
        />

        <div className="flex flex-col gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-xs">
            <span className="block text-label-md text-on-surface-variant">From</span>
            <DatePicker value={dateFrom} onChange={setDateFrom} className="w-full sm:w-[11rem]" />
          </div>
          <div className="space-y-xs">
            <span className="block text-label-md text-on-surface-variant">To</span>
            <DatePicker value={dateTo} onChange={setDateTo} className="w-full sm:w-[11rem]" />
          </div>
          {rangeInvalid && <FormAlert className="sm:flex-1">The start date is after the end date. Pick a start on or before {formatClinicDateShort(dateTo)}.</FormAlert>}
        </div>

        {rangeInvalid ? null : loadError ? (
          <ErrorState title="Reports unavailable" message="Report data could not be loaded for this range. No totals are shown while the request has failed." onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
        ) : loading ? (
          <div className="space-y-lg" aria-busy="true">
            <p className="sr-only" role="status">Loading reports…</p>
            <SkeletonStats />
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : (
        <>
        <dl className="grid grid-cols-2 gap-md lg:grid-cols-4">
          {[
            ["Revenue", formatPeso(totals.revenue, "₱0")],
            ["Unpaid after visit", formatPeso(unpaidTotal, "₱0")],
            ["Visits", String(totals.visits)],
            ["No-shows", String(totals.noShows)],
          ].map(([label, value], i) => (
            <div key={label} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
              <dt className="text-label-md text-on-surface-variant">{label}</dt>
              <dd className={i === 0 ? "mt-xs text-headline-lg tabular-nums text-primary" : "mt-xs text-headline-lg tabular-nums text-on-surface"}>{value}</dd>
            </div>
          ))}
        </dl>

        <Card>
          <div className="mb-md flex flex-wrap items-baseline justify-between gap-sm">
            <h2 className="text-headline-sm text-on-surface">Completed visits not yet paid</h2>
            <span className="text-label-md tabular-nums text-on-surface-variant">{unpaidCompleted.length} visits · {formatPeso(unpaidTotal, "₱0")}</span>
          </div>
          {unpaidCompleted.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Every completed visit in this range is settled.</p>
          ) : (
            <>
              <ul className="divide-y divide-outline-variant sm:hidden">
                {unpaidCompleted.map((b) => (
                  <li key={b.bookingId}>
                    <Link href={`/admin/bookings/${b.bookingId}`} className="flex min-h-11 items-center justify-between gap-md py-sm">
                      <span className="min-w-0">
                        <span className="block text-body-md font-medium text-on-surface">{b.patientName}</span>
                        <span className="block text-label-md text-on-surface-variant">{b.doctorName} · <span className="tabular-nums">{formatClinicDateShort(b.visitDate)}</span></span>
                      </span>
                      <span className="shrink-0 text-body-md tabular-nums text-on-surface">{formatPeso(b.amountDue)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="text-left">
                      <th className={th}>Patient</th><th className={th}>Doctor</th><th className={th}>Visit date</th><th className={`${th} text-right`}>Amount due</th><th className={`${th} text-right`}><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidCompleted.map((b) => (
                      <tr key={b.bookingId} className="border-t border-outline-variant">
                        <td className={`${td} font-medium text-on-surface`}>{b.patientName}</td>
                        <td className={td}>{b.doctorName}</td>
                        <td className={`${td} tabular-nums`}>{formatClinicDateShort(b.visitDate)}</td>
                        <td className={`${td} text-right tabular-nums`}>{formatPeso(b.amountDue)}</td>
                        <td className={`${td} text-right`}>
                          <Link href={`/admin/bookings/${b.bookingId}`} className="text-label-md font-medium text-primary hover:underline">
                            Open booking
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Pending follow-ups</h2>
          {pendingFollowUps.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No pending follow-ups in this range.</p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {pendingFollowUps.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-sm py-sm">
                  <span className="min-w-0">
                    <span className="block text-body-md font-medium text-on-surface">{c.patientName}</span>
                    <span className="block text-label-md text-on-surface-variant">{c.reason} · {c.doctorName}</span>
                  </span>
                  <span className="text-label-md tabular-nums text-on-surface">{formatClinicDateShort(c.followUpDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Day by day</h2>
          {dailySummary.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No bookings in this range.</p>
          ) : (
            <>
              <ul className="divide-y divide-outline-variant sm:hidden">
                {dailySummary.map((row) => (
                  <li key={row.date} className="py-sm text-body-md">
                    <div className="flex items-baseline justify-between gap-md">
                      <p className="font-medium tabular-nums text-on-surface">{formatClinicDateShort(row.date)}</p>
                      <p className="tabular-nums text-on-surface">{formatPeso(row.revenue, "₱0")}</p>
                    </div>
                    <p className="text-label-md tabular-nums text-on-surface-variant">
                      {row.total} total · {row.completed} completed · {row.paid} paid · {row.unpaid} unpaid · {row.noShows} no-shows
                    </p>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-body-md tabular-nums">
                  <thead>
                    <tr className="text-left">
                      <th className={th}>Date</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Completed</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Unpaid</th><th className={`${th} text-right`}>No-shows</th><th className={`${th} text-right`}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.map((row) => (
                      <tr key={row.date} className="border-t border-outline-variant">
                        <td className={td}>{formatClinicDateShort(row.date)}</td>
                        <td className={`${td} text-right`}>{row.total}</td>
                        <td className={`${td} text-right`}>{row.completed}</td>
                        <td className={`${td} text-right`}>{row.paid}</td>
                        <td className={`${td} text-right`}>{row.unpaid}</td>
                        <td className={`${td} text-right`}>{row.noShows}</td>
                        <td className={`${td} text-right`}>{formatPeso(row.revenue, "₱0")}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-outline-variant font-semibold text-on-surface">
                      <td className={td}>Total</td>
                      <td className={`${td} text-right`}>{totals.visits}</td>
                      <td className={`${td} text-right`}>{totals.completed}</td>
                      <td className={`${td} text-right`}>{dailySummary.reduce((n, r) => n + r.paid, 0)}</td>
                      <td className={`${td} text-right`}>{dailySummary.reduce((n, r) => n + r.unpaid, 0)}</td>
                      <td className={`${td} text-right`}>{totals.noShows}</td>
                      <td className={`${td} text-right`}>{formatPeso(totals.revenue, "₱0")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </Card>
        </>
        )}
      </div>
    </AppShell>
  );
}
