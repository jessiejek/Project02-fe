"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { queryQueue, updateQueueEntry, type QueueBoard } from "@/lib/data/queue";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

// §16.3 — today's walk-in FCFS queue board.
export default function StaffQueuePage() {
  const [board, setBoard] = useState<QueueBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = null as never;
    try {
      setBoard(await queryQueue(supabase));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Real-time (below) is the primary trigger; this poll is just the
    // fallback for a dropped/blocked SignalR connection, so it can be slow.
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useClinicHubEvent("PatientCheckedIn", refresh);
  useClinicHubEvent("QueueUpdated", refresh);
  // Amount Due drops to 0 once paid — without this it sits stale here.
  useClinicHubEvent("PaymentUpdated", refresh);

  async function act(bookingId: string, action: "call" | "hold" | "complete" | "no-show") {
    setBusyId(bookingId);
    const supabase = null as never;
    try {
      await updateQueueEntry(supabase, bookingId, action);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const s = board?.summary;

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-lg text-on-surface">Today&apos;s Queue</h2>
          <Link href="/staff/walk-in">
            <Button>+ Check In Walk-In</Button>
          </Link>
        </div>

        {loading && <SkeletonStats count={5} />}

        {s && (
          <div className="grid grid-cols-2 gap-md sm:grid-cols-5">
            <Card><p className="text-headline-lg text-on-surface">{s.waiting}</p><p className="text-label-md text-on-surface-variant">Waiting</p></Card>
            <Card><p className="text-headline-lg text-on-surface">{s.in_progress}</p><p className="text-label-md text-on-surface-variant">In Progress</p></Card>
            <Card><p className="text-headline-lg text-on-surface">{s.completed}</p><p className="text-label-md text-on-surface-variant">Completed</p></Card>
            <Card><p className="text-headline-lg text-on-surface">{s.no_show}</p><p className="text-label-md text-on-surface-variant">No-show</p></Card>
            <Card><p className="text-headline-lg text-on-surface">{s.total}</p><p className="text-label-md text-on-surface-variant">Total</p></Card>
          </div>
        )}

        {loading && <SkeletonTable rows={5} columns={6} />}

        {!loading && board && board.items.length === 0 && (
          <Card><p className="text-body-md text-on-surface-variant">No one in the queue yet today.</p></Card>
        )}

        {!loading && board && board.items.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                    <th className="px-lg py-sm text-center">#</th>
                    <th className="px-lg py-sm">Patient</th>
                    <th className="px-lg py-sm">Visit</th>
                    <th className="px-lg py-sm text-right">Amount Due</th>
                    <th className="px-lg py-sm">Status</th>
                    <th className="px-lg py-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {board.items.map((e) => (
                    <tr key={e.booking_id} className="align-middle">
                      <td className="px-lg py-md text-center font-medium">{e.queue_number}</td>
                      <td className="px-lg py-md">
                        <Link href={`/staff/bookings/${e.booking_id}`} className="text-primary hover:underline">
                          {e.patient_name}
                        </Link>
                        <span className="block text-label-sm text-on-surface-variant">{e.patient_code}</span>
                      </td>
                      <td className="px-lg py-md">{e.visit_type === "FollowUp" ? "Follow-up" : "New"}</td>
                      <td className="px-lg py-md text-right">₱{e.amount_due}</td>
                      <td className="px-lg py-md"><StatusPill status={e.status} /></td>
                      <td className="px-lg py-md">
                        <div className="flex flex-wrap gap-xs">
                          {(e.status === "CheckedIn" || e.status === "OnHold") && (
                            <Button variant="secondary" className="!px-sm !py-xs text-label-sm" disabled={busyId === e.booking_id} onClick={() => act(e.booking_id, "call")}>
                              Call
                            </Button>
                          )}
                          {e.status === "InProgress" && (
                            <>
                              <Link href={`/doctor/consultation/${e.booking_id}`}>
                                <Button variant="secondary" className="!px-sm !py-xs text-label-sm">Open Consult</Button>
                              </Link>
                              <Button variant="secondary" className="!px-sm !py-xs text-label-sm" disabled={busyId === e.booking_id} onClick={() => act(e.booking_id, "complete")}>
                                Complete
                              </Button>
                            </>
                          )}
                          {(e.status === "CheckedIn" || e.status === "OnHold" || e.status === "InProgress") && (
                            <>
                              <Button variant="ghost" className="!px-sm !py-xs text-label-sm" disabled={busyId === e.booking_id} onClick={() => act(e.booking_id, "hold")}>
                                Hold
                              </Button>
                              <Button variant="ghost" className="!px-sm !py-xs text-label-sm text-error" disabled={busyId === e.booking_id} onClick={() => act(e.booking_id, "no-show")}>
                                No-show
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
