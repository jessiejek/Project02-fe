"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { StatCard } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
import { queryReport } from "@/lib/data/admin";

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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = `${today.slice(0, 7)}-01`;
      const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      const [
        todaySummaryRes,
        monthBookingsRes,
        monthRevenueRes,
        pendingRes,
        onHoldRes,
        unpaidRes,
        followUpsRes,
        doctorsRes,
        recentRes,
      ] = await Promise.all([
        queryReport<Record<string, any>>(supabase, "v_daily_booking_summary").then((rows) => ({
          data: rows.find((r) => r.appointment_date === today) ?? null,
        })),
        supabase.from("bookings").select("booking_id", { count: "exact", head: true }).gte("appointment_date", monthStart),
        queryReport<Record<string, any>>(supabase, "v_daily_booking_summary").then((rows) => ({
          data: rows.filter((r) => (r.appointment_date as string) >= monthStart),
        })),
        supabase.from("bookings").select("booking_id", { count: "exact", head: true }).eq("status", "ProofSubmitted"),
        supabase.from("bookings").select("booking_id", { count: "exact", head: true }).eq("status", "OnHold").gte("appointment_date", monthStart),
        queryReport<Record<string, any>>(supabase, "v_unpaid_completed_visits").then((rows) => ({ count: rows.length })),
        queryReport<Record<string, any>>(supabase, "v_pending_follow_ups").then((rows) => ({
          count: rows.filter(
            (r) => (r.follow_up_date as string) >= today && (r.follow_up_date as string) <= in7Days,
          ).length,
        })),
        queryDoctors(supabase),
        supabase
          .from("bookings")
          .select("*, patients(first_name, last_name), doctors(staff_accounts(full_name))")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setTodaysCount(todaySummaryRes.data?.total_bookings ?? 0);
      setNoShowsToday(todaySummaryRes.data?.no_show_count ?? 0);
      setRevenueToday(Number(todaySummaryRes.data?.revenue ?? 0));
      setMonthlyCount(monthBookingsRes.count ?? 0);
      setRevenueThisMonth((monthRevenueRes.data ?? []).reduce((sum, d) => sum + Number(d.revenue ?? 0), 0));
      setPendingVerifications(pendingRes.count ?? 0);
      setOnHoldThisMonth(onHoldRes.count ?? 0);
      setUnpaidCompleted(unpaidRes.count ?? 0);
      setFollowUpsDue(followUpsRes.count ?? 0);

      const bookingCountByDoctor = new Map<string, number>();
      (recentRes.data ?? []).forEach((b) => {
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
        (recentRes.data ?? []).map((b) => {
          const patient = Array.isArray(b.patients) ? b.patients[0] : b.patients;
          const doctor = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
          const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
          return {
            id: b.booking_id,
            patientName: patient ? `${patient.first_name} ${patient.last_name}` : "",
            doctorName: staff?.full_name ?? "",
            slotStartTime: b.slot_start_time.slice(0, 5),
            queueNumber: b.queue_number,
            status: b.status,
          };
        }),
      );

      setLoaded(true);
    }
    load();
  }, []);

  if (!loaded) {
    return (
      <AppShell role="admin">
        <p className="text-body-md text-on-surface-variant">Loading dashboard…</p>
      </AppShell>
    );
  }

  const maxLoad = Math.max(1, ...doctorLoads.map((d) => d.bookingCount));

  return (
    <AppShell role="admin" roleBadge={<span className="rounded-full bg-tertiary-container px-md py-xs text-label-sm text-on-tertiary-container">Admin</span>}>
      <div className="space-y-xl">
        <h2 className="text-headline-lg text-on-surface">Admin Dashboard</h2>

        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 md:grid-cols-4">
          <StatCard icon="event_note" value={todaysCount} label="Today's Appointments" />
          <StatCard icon="calendar_month" value={monthlyCount} label="Monthly Appointments" />
          <StatCard icon="payments" value={`₱${revenueToday.toLocaleString()}`} label="Revenue Today" />
          <StatCard icon="pending_actions" value={pendingVerifications} label="Pending Verifications" />
          <StatCard icon="hourglass_top" value={onHoldThisMonth} label="On Hold (month)" />
          <StatCard icon="receipt_long" value={unpaidCompleted} label="Unpaid Completed" />
          <StatCard icon="event_busy" value={noShowsToday} label="No Shows Today" />
          <StatCard icon="follow_the_signs" value={followUpsDue} label="Follow-Ups Due in 7 Days" />
        </div>

        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
            <h3 className="mb-md text-headline-sm text-on-surface">Most Booked Doctors</h3>
            <div className="space-y-sm">
              {doctorLoads.map((d) => (
                <div key={d.id} className="flex items-center gap-md">
                  <span className="w-32 truncate text-label-md text-on-surface-variant">{d.name}</span>
                  <div className="h-3 flex-1 rounded-full bg-surface-container-high">
                    <div className="h-3 rounded-full bg-primary" style={{ width: `${(d.bookingCount / maxLoad) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
            <h3 className="mb-md text-headline-sm text-on-surface">Revenue This Month</h3>
            <p className="text-body-md text-on-surface-variant">₱{revenueThisMonth.toLocaleString()}</p>
          </div>
        </div>

        <DataTable
          columns={[
            { header: "Patient", render: (r) => r.patientName },
            { header: "Doctor", render: (r) => r.doctorName },
            { header: "Time", render: (r) => r.slotStartTime },
            { header: "Queue #", align: "center", render: (r) => r.queueNumber ?? "—" },
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
                {r.slotStartTime} · Q#{r.queueNumber ?? "—"}
              </p>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
