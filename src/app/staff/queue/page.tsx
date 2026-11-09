"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormAlert } from "@/components/ui/FormAlert";
import { Icon } from "@/components/ui/Icon";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { formatPeso } from "@/lib/format";
import { queryQueue, updateQueueEntry, cancelQueueEntry, type QueueBoard, type QueueEntry } from "@/lib/data/queue";
import { ApiError } from "@/lib/api/client";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

// §16.3 — today's walk-in FCFS queue board.
export default function StaffQueuePage() {
  const [board, setBoard] = useState<QueueBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<QueueEntry | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState("");

  const refresh = useCallback(async () => {
    const supabase = null as never;
    try {
      setBoard(await queryQueue(supabase));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void refresh(); });
    // Real-time (below) is the primary trigger; this poll is just the
    // fallback for a dropped/blocked SignalR connection, so it can be slow.
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useClinicHubEvent("PatientCheckedIn", refresh);
  useClinicHubEvent("QueueUpdated", refresh);
  // Amount Due drops to 0 once paid — without this it sits stale here.
  useClinicHubEvent("PaymentUpdated", refresh);

  async function act(bookingId: string, action: "check-in" | "call" | "hold" | "complete" | "no-show") {
    setBusyId(bookingId);
    setActionError("");
    const supabase = null as never;
    try {
      await updateQueueEntry(supabase, bookingId, action);
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? err.message) : "That queue update didn’t go through. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function closeCancel() {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError("Please enter a reason.");
      return;
    }
    setCancelError("");
    setCancelling(true);
    try {
      await cancelQueueEntry(cancelTarget.booking_id, cancelReason.trim());
      await refresh();
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      setCancelError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? err.message) : "Could not cancel the booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const s = board?.summary;
  const stats: { label: string; value: number; accent?: boolean }[] = s
    ? [
        { label: "Waiting", value: s.waiting, accent: true },
        { label: "With doctor", value: s.in_progress },
        { label: "Booked, not arrived", value: s.booked },
        { label: "Completed", value: s.completed },
        { label: "No-show", value: s.no_show },
        { label: "Total today", value: s.total },
      ]
    : [];
  const small = "!min-h-9 !px-sm !py-xs text-label-sm";

  function renderActions(e: QueueEntry, align = "") {
    const busy = busyId === e.booking_id;
    return (
        <div className={`flex flex-wrap gap-xs ${align}`}>
          {e.status === "Pending" && (
            <>
              <Button className={small} loading={busy} onClick={() => act(e.booking_id, "check-in")}>
                Check in
              </Button>
              <Button variant="ghost" className={`${small} text-error`} disabled={busy} onClick={() => act(e.booking_id, "no-show")}>
                No-show
              </Button>
            </>
          )}
          {(e.status === "CheckedIn" || e.status === "OnHold") && (
            <Button className={small} loading={busy} onClick={() => act(e.booking_id, "call")}>
              Call in
            </Button>
          )}
          {e.status === "InProgress" && (
            <>
              <Link href={`/doctor/consultation/${e.booking_id}`} className={buttonStyles("secondary", small)}>Open consult</Link>
              <Button variant="secondary" className={small} loading={busy} onClick={() => act(e.booking_id, "complete")}>
                Complete
              </Button>
            </>
          )}
          {(e.status === "CheckedIn" || e.status === "OnHold" || e.status === "InProgress") && (
            <>
              <Button variant="ghost" className={small} disabled={busy} onClick={() => act(e.booking_id, "hold")}>
                Hold
              </Button>
              <Button variant="ghost" className={`${small} text-error`} disabled={busy} onClick={() => act(e.booking_id, "no-show")}>
                No-show
              </Button>
            </>
          )}
          {(e.status === "CheckedIn" || e.status === "OnHold") && (
            <Button variant="ghost" className={`${small} text-error`} disabled={busy} onClick={() => setCancelTarget(e)}>
              Cancel
            </Button>
          )}
        </div>
    );
  }

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <PageHeader
          title="Today’s queue"
          description="First come, first served. Call the next patient, hold, or mark a no-show."
          actions={
            <Link href="/staff/walk-in" className={buttonStyles("primary")}>
              <Icon name="add_circle" className="text-[16px]" />
              Check in walk-in
            </Link>
          }
        />

        {loading && <SkeletonStats count={6} />}

        {!loading && loadError && !board && (
          <ErrorState title="The queue didn’t load" message="Check the connection to the clinic server, then try again." onRetry={() => { setLoading(true); refresh(); }} />
        )}

        {s && (
          <dl className="grid grid-cols-3 gap-sm sm:gap-md lg:grid-cols-6">
            {stats.map((st) => (
              <Card key={st.label} className="flex flex-col-reverse justify-end gap-xs p-md sm:p-lg">
                <dt className="text-label-md text-on-surface-variant">{st.label}</dt>
                <dd className={`text-headline-md tabular-nums sm:text-headline-lg ${st.accent ? "text-primary" : "text-on-surface"}`}>{st.value}</dd>
              </Card>
            ))}
          </dl>
        )}

        {!loading && loadError && board && (
          <FormAlert tone="warning">Couldn’t refresh just now. Showing the last loaded queue.</FormAlert>
        )}
        {actionError && <FormAlert>{actionError}</FormAlert>}

        {loading && <SkeletonTable rows={5} columns={6} />}

        {!loading && board && board.items.length === 0 && (
          <EmptyState icon="groups" message="No one in the queue yet today." />
        )}

        {!loading && board && board.items.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
            <ul className="divide-y divide-outline-variant/30 md:hidden">
              {board.items.map((e) => (
                <li key={e.booking_id} className="space-y-sm p-lg" aria-busy={busyId === e.booking_id || undefined}>
                  <div className="flex items-start justify-between gap-md">
                    <div className="flex min-w-0 items-start gap-md">
                      <span className="whitespace-nowrap text-headline-sm tabular-nums text-on-surface">{e.queue_number}</span>
                      <div className="min-w-0">
                        <Link href={`/staff/bookings/${e.booking_id}`} className="break-words text-body-md font-medium text-primary hover:underline">{e.patient_name}</Link>
                        <p className="text-label-md text-on-surface-variant">
                          {e.visit_type === "FollowUp" ? "Follow-up" : "New"} · {e.is_walk_in ? "Walk-in" : "Booked online"} · <span className="tabular-nums">{formatPeso(e.amount_due)}</span>
                        </p>
                      </div>
                    </div>
                    <StatusPill status={e.status} />
                  </div>
                  {renderActions(e)}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                    <th className="px-lg py-sm text-right font-medium">No.</th>
                    <th className="px-lg py-sm font-medium">Patient</th>
                    <th className="px-lg py-sm font-medium">Visit</th>
                    <th className="px-lg py-sm text-right font-medium">Amount due</th>
                    <th className="px-lg py-sm font-medium">Status</th>
                    <th className="px-lg py-sm font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 text-body-md text-on-surface">
                  {board.items.map((e) => {
                    const busy = busyId === e.booking_id;
                    return (
                    <tr key={e.booking_id} className="align-middle" aria-busy={busy || undefined}>
                      <td className="whitespace-nowrap px-lg py-md text-right text-headline-sm tabular-nums">{e.queue_number}</td>
                      <td className="px-lg py-md">
                        <Link href={`/staff/bookings/${e.booking_id}`} className="font-medium text-primary hover:underline">
                          {e.patient_name}
                        </Link>
                        <span className="block text-label-sm text-on-surface-variant">
                          <span className="font-mono">{e.patient_code}</span> · {e.is_walk_in ? "Walk-in" : "Booked online"}
                        </span>
                      </td>
                      <td className="px-lg py-md">{e.visit_type === "FollowUp" ? "Follow-up" : "New"}</td>
                      <td className="px-lg py-md text-right tabular-nums">{formatPeso(e.amount_due)}</td>
                      <td className="px-lg py-md"><StatusPill status={e.status} /></td>
                      <td className="px-lg py-md">
                        {renderActions(e, "justify-end")}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={cancelTarget !== null}
        onClose={closeCancel}
        title={cancelTarget ? `Cancel queue ${cancelTarget.queue_number}?` : "Cancel booking"}
        footer={
          <>
            <Button variant="secondary" onClick={closeCancel} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel booking"}
            </Button>
          </>
        }
      >
        <div className="space-y-md text-body-md text-on-surface">
          {cancelError && <FormAlert>{cancelError}</FormAlert>}
          <p>
            Cancel <span className="font-medium">{cancelTarget?.queue_number}</span> for{" "}
            <span className="font-medium">{cancelTarget?.patient_name}</span>? They will be removed from today&apos;s queue.
          </p>
          <div className="space-y-xs">
            <label htmlFor="cancelReason" className="text-label-md text-on-surface-variant">
              Reason
            </label>
            <textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Patient left, changed their mind, duplicate entry"
              rows={3}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-md text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
