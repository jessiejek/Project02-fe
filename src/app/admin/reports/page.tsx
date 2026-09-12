"use client";

import { useEffect, useState } from "react";
import { todayManila } from "@/lib/clock";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
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
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(todayManila());
  const [loading, setLoading] = useState(true);
  const [unpaidCompleted, setUnpaidCompleted] = useState<UnpaidVisitRow[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUpRow[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummaryRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = null as never;
      const inRange = (d: string | null | undefined, lo: string, hi: string) => !!d && d >= lo && d <= hi;
      const [unpaidAll, followUpsAll, summaryAll] = await Promise.all([
        queryReport<Record<string, any>>(supabase, "v_unpaid_completed_visits"),
        queryReport<Record<string, any>>(supabase, "v_pending_follow_ups"),
        queryReport<Record<string, any>>(supabase, "v_daily_booking_summary"),
      ]);
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
            bookingId: b.booking_id ?? "",
            patientName: b.patient_name ?? "Unknown Patient",
            doctorName: b.doctor_name ?? "Unknown Doctor",
            visitDate: b.appointment_date ?? "",
            amountDue: Number(b.amount_due ?? 0),
          })),
      );

      setPendingFollowUps(
        (followUpsRes.data ?? []).map((f) => ({
          id: f.follow_up_id ?? "",
          patientName: f.patient_name ?? "Unknown Patient",
          doctorName: f.doctor_name ?? "Unknown Doctor",
          reason: f.reason ?? "Follow-up",
          followUpDate: f.follow_up_date ?? "",
        })),
      );

      setDailySummary(
        (summaryRes.data ?? []).map((row) => ({
          date: row.appointment_date ?? "",
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
  }, [dateFrom, dateTo]);

  if (loading) {
    return (
      <AppShell role="admin">
        <div className="space-y-lg">
          <SkeletonStats />
          <SkeletonTable rows={5} columns={5} />
        </div>
      </AppShell>
    );
  }

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

  return (
    <AppShell role="admin">
      <div className="space-y-xl">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Reports</h2>
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={unpaidCompleted.length === 0 && dailySummary.length === 0 && pendingFollowUps.length === 0}
          >
            Export CSV
          </Button>
        </div>

        <Card className="flex flex-col gap-md sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex w-full flex-col gap-xs text-label-md text-on-surface-variant sm:w-auto sm:flex-row sm:items-center sm:gap-sm">
            From
            <DatePicker value={dateFrom} onChange={setDateFrom} className="w-full sm:w-[10rem]" />
          </label>
          <label className="flex w-full flex-col gap-xs text-label-md text-on-surface-variant sm:w-auto sm:flex-row sm:items-center sm:gap-sm">
            To
            <DatePicker value={dateTo} onChange={setDateTo} className="w-full sm:w-[10rem]" />
          </label>
        </Card>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Unpaid Completed Appointments</h3>
          {unpaidCompleted.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No unpaid completed appointments in this range.</p>
          ) : (
            <>
              <div className="space-y-sm sm:hidden">
                {unpaidCompleted.map((b) => (
                  <div key={b.bookingId} className="space-y-xs rounded-lg border border-outline-variant p-md">
                    <p className="text-body-md font-medium text-on-surface">{b.patientName}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {b.doctorName} · {b.visitDate}
                    </p>
                    <div className="flex items-center justify-between gap-md">
                      <span className="text-body-md text-on-surface">₱{b.amountDue}</span>
                      <Link href={`/admin/bookings/${b.bookingId}`} className="text-label-md text-primary hover:underline">
                        View Booking
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant">
                      <th className="py-sm">Patient</th><th className="py-sm">Doctor</th><th className="py-sm">Appointment Date</th><th className="py-sm text-right">Amount Due</th><th className="py-sm text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidCompleted.map((b) => (
                      <tr key={b.bookingId} className="border-t border-outline-variant/40">
                        <td className="py-sm">{b.patientName}</td>
                        <td className="py-sm">{b.doctorName}</td>
                        <td className="py-sm">{b.visitDate}</td>
                        <td className="py-sm text-right">₱{b.amountDue}</td>
                        <td className="py-sm text-right">
                          <Link href={`/admin/bookings/${b.bookingId}`} className="text-label-md text-primary hover:underline">
                            View Booking
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
          <h3 className="mb-md text-headline-sm text-on-surface">Pending Follow-Ups</h3>
          {pendingFollowUps.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No pending follow-ups in this range.</p>
          ) : (
            <div className="space-y-sm">
              {pendingFollowUps.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-md rounded-lg border border-outline-variant p-md text-body-md text-on-surface-variant">
                  <span>{c.patientName} — {c.doctorName} — {c.reason} — {c.followUpDate}</span>
                  <Button variant="secondary" disabled>
                    Send Reminder <span className="ml-xs rounded bg-surface-container-high px-1 text-[10px]">In Progress</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Daily Booking Summary</h3>
          {dailySummary.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No bookings in this range.</p>
          ) : (
            <>
              <div className="space-y-sm sm:hidden">
                {dailySummary.map((row) => (
                  <div key={row.date} className="rounded-lg border border-outline-variant p-md text-body-md">
                    <p className="mb-xs font-medium text-on-surface">{row.date}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      Total {row.total} · Completed {row.completed} · Paid {row.paid} · Unpaid {row.unpaid} · No-shows {row.noShows}
                    </p>
                    <p className="mt-xs text-on-surface">Revenue ₱{row.revenue}</p>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant">
                      <th className="py-sm">Date</th><th className="py-sm text-right">Total</th><th className="py-sm text-right">Completed</th><th className="py-sm text-right">Paid</th><th className="py-sm text-right">Unpaid</th><th className="py-sm text-right">No-Shows</th><th className="py-sm text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.map((row) => (
                      <tr key={row.date} className="border-t border-outline-variant/40">
                        <td className="py-sm">{row.date}</td>
                        <td className="py-sm text-right">{row.total}</td>
                        <td className="py-sm text-right">{row.completed}</td>
                        <td className="py-sm text-right">{row.paid}</td>
                        <td className="py-sm text-right">{row.unpaid}</td>
                        <td className="py-sm text-right">{row.noShows}</td>
                        <td className="py-sm text-right">₱{row.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
