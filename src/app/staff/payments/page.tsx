"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateShort, formatPeso } from "@/lib/format";
import { todayManila } from "@/lib/clock";
import { queryQueue } from "@/lib/data/queue";
import { queryStaffBookings } from "@/lib/data/bookings";
import { confirmPayment as confirmPaymentApi } from "@/lib/data/payments";
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

interface QueueRow {
  id: string;
  patientName: string;
  patientCode: string;
  appointmentDate: string;
  queueNumber: string | null;
  amountDue: number;
}

function newOrNumber(bookingId: string) {
  return `OR-${bookingId.slice(0, 8).toUpperCase()}`;
}

// Was querying the generic /api/bookings?status=Completed directly (no date
// scope, no page-size hint) and filtering for Unpaid client-side — a third
// definition of "who owes money" alongside the walk-in queue board and the
// staff/today bookings list, and the three didn't agree (a booking the queue
// board showed as Completed+owing never showed up here). Reading the same
// queue board the Staff Queue page and both dashboards already use closes
// that gap for today's visits.
//
// The queue board only ever holds today's walk-ins, so it can't surface a
// patient who went unpaid on an earlier day and comes back later — for that
// we still need /api/bookings/staff/for-payment, a purpose-built endpoint
// that existed in this codebase but was never wired to any screen. It's
// merged in as a supplement (deduped against the queue board, which stays
// authoritative for today) rather than trusted alone, since its own
// correctness hasn't been independently verified the way the queue board's
// has — if it turns out to be unreliable too, this degrades to "today only"
// rather than silently hiding today's real data.
export default function PaymentsQueuePage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [lastPaid, setLastPaid] = useState("");
  const activeBooking = useMemo(() => queue.find((q) => q.id === activeId) ?? null, [queue, activeId]);

  const totalDue = queue.reduce((sum, b) => sum + b.amountDue, 0);

  async function load() {
    const supabase = null as never;
    let board;
    try {
      board = await queryQueue(supabase);
    } catch {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    const today: QueueRow[] = board.items
      .filter((e) => e.status === "Completed" && Number(e.amount_due) > 0)
      .map((e) => ({
        id: e.booking_id,
        patientName: e.patient_name || "—",
        patientCode: e.patient_code ?? "",
        appointmentDate: board.date,
        queueNumber: e.queue_number,
        amountDue: Number(e.amount_due),
      }));

    // The queue board is same-day only and already proved reliable; this
    // supplemental list is scoped to strictly *earlier* days and still
    // requires Completed, so even if the for-payment endpoint misbehaves on
    // today's bookings (it has — it returned a Checked-In and an In-Progress
    // visit with the fix's first draft), it can't override or duplicate what
    // the queue board already got right for today.
    const todayStr = todayManila();
    const seen = new Set(today.map((r) => r.id));
    let older: QueueRow[] = [];
    try {
      const rows = await queryStaffBookings(supabase, "for-payment");
      older = rows
        .filter((b) => !seen.has(b.booking_id) && b.status === "Completed" && b.appointment_date < todayStr && Number(b.amount_due) > 0)
        .map((b) => ({
          id: b.booking_id,
          patientName: [b.patients?.first_name, b.patients?.last_name].filter(Boolean).join(" ") || "—",
          patientCode: b.patients?.patient_code ?? "",
          appointmentDate: b.appointment_date,
          queueNumber: b.queue_number,
          amountDue: Number(b.amount_due),
        }));
    } catch {
      // The for-payment endpoint is unverified — if it fails, today's real
      // queue-board data (already loaded above) still renders correctly.
      older = [];
    }

    setQueue([...today, ...older]);
    setLoading(false);
  }

  useEffect(() => {
    //JJQR - AI (Oct 31, 2026)
    queueMicrotask(() => {
      void load();
    });
    //JJQR - END
  }, []);

  // A visit going Completed is what makes it show up here; a payment
  // getting confirmed/waived elsewhere is what makes it drop off.
  useClinicHubEvent("QueueUpdated", load);
  useClinicHubEvent("PaymentUpdated", load);

  // Fallback poll for a dropped/blocked SignalR connection (same pattern as
  // /staff/queue) — self-corrects within a minute if push doesn't arrive.
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  async function handleConfirm() {
    if (!activeBooking) return;
    setSubmitting(true);
    setConfirmError("");
    const supabase = null as never;
    try {
      await confirmPaymentApi(supabase, activeBooking.id, {
        paymentMethod,
        amountReceived: Number(amountReceived) || activeBooking.amountDue,
        referenceNumber: referenceNumber.trim() || null,
        confirmNotes: confirmNotes.trim() || null,
        orNumber: newOrNumber(activeBooking.id),
      });
    } catch (e) {
      // Keep the modal and the typed details so the desk can retry.
      setConfirmError(e instanceof Error && e.message ? e.message : "The payment was not recorded. Please try again.");
      setSubmitting(false);
      return;
    }

    setLastPaid(`${formatPeso(Number(amountReceived) || activeBooking.amountDue)} recorded for ${activeBooking.patientName}.`);
    setQueue((prev) => prev.filter((b) => b.id !== activeBooking.id));
    setSubmitting(false);
    setActiveId(null);
    setPaymentMethod("Cash");
    setAmountReceived("");
    setReferenceNumber("");
    setConfirmNotes("");
  }

  function openPayment(r: QueueRow) {
    setConfirmError("");
    setActiveId(r.id);
    setAmountReceived(String(r.amountDue));
  }

  function closePayment() {
    if (submitting) return;
    setActiveId(null);
    setConfirmError("");
  }

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <PageHeader
          title="Collect payments"
          description="Patients whose visit is done and who still owe the fee, today first, then earlier days."
        />

        {loading ? (
          <div className="space-y-lg" aria-busy="true">
            <SkeletonStats count={2} />
            <SkeletonTable rows={6} columns={4} />
          </div>
        ) : loadError ? (
          <ErrorState
            title="The payment list didn’t load"
            message="Check the connection to the clinic server, then try again."
            retrying={retrying}
            onRetry={async () => { setRetrying(true); await load(); setRetrying(false); }}
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-md sm:max-w-[32rem]">
              <Card className="flex flex-col-reverse gap-xs">
                <dt className="text-label-md text-on-surface-variant">Waiting to pay</dt>
                <dd className="text-headline-lg tabular-nums text-on-surface">{queue.length}</dd>
              </Card>
              <Card className="flex flex-col-reverse gap-xs">
                <dt className="text-label-md text-on-surface-variant">Total due</dt>
                <dd className="text-headline-lg tabular-nums text-primary">{formatPeso(totalDue)}</dd>
              </Card>
            </dl>

            {lastPaid && <FormAlert tone="success">{lastPaid}</FormAlert>}

            <DataTable
              columns={[
                {
                  header: "Patient",
                  render: (r) => (
                    <span className="block min-w-0">
                      <span className="block font-medium text-on-surface">{r.patientName}</span>
                      {r.patientCode && <span className="block font-mono text-body-sm text-on-surface-variant">{r.patientCode}</span>}
                    </span>
                  ),
                },
                { header: "Visit date", render: (r) => <span className="tabular-nums">{formatClinicDateShort(r.appointmentDate)}</span> },
                { header: "Queue", align: "right", render: (r) => <span className="tabular-nums">{r.queueNumber ?? "—"}</span> },
                { header: "Amount due", align: "right", render: (r) => <span className="font-medium tabular-nums">{formatPeso(r.amountDue)}</span> },
                {
                  header: "",
                  align: "right",
                  render: (r) => <Button variant="secondary" onClick={() => openPayment(r)}>Record payment</Button>,
                },
              ]}
              rows={queue}
              rowKey={(r) => r.id}
              emptyMessage="Everyone has paid. Nothing to collect right now."
              renderMobileCard={(r) => (
                <div className="space-y-sm">
                  <div className="flex items-start justify-between gap-md">
                    <div className="min-w-0">
                      <p className="break-words text-body-md font-medium text-on-surface">{r.patientName}</p>
                      <p className="text-label-md tabular-nums text-on-surface-variant">
                        {r.patientCode && <span className="font-mono">{r.patientCode} · </span>}
                        {formatClinicDateShort(r.appointmentDate)} · Queue {r.queueNumber ?? "—"}
                      </p>
                    </div>
                    <p className="text-body-md font-medium tabular-nums text-on-surface">{formatPeso(r.amountDue)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPayment(r);
                    }}
                  >
                    Record payment
                  </Button>
                </div>
              )}
            />
          </>
        )}
      </div>

      <Modal
        isOpen={activeId !== null}
        onClose={closePayment}
        title={activeBooking ? `Record payment of ${formatPeso(activeBooking.amountDue)}` : "Record payment"}
        footer={
          <>
            <Button variant="secondary" onClick={closePayment} disabled={submitting}>
              Back
            </Button>
            <Button onClick={handleConfirm} loading={submitting} disabled={!activeBooking}>
              {submitting ? "Recording…" : "Record payment"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {activeBooking && (
            <p className="text-body-md text-on-surface">
              {activeBooking.patientName}
              {activeBooking.patientCode && <span className="font-mono text-body-sm text-on-surface-variant"> · {activeBooking.patientCode}</span>}
            </p>
          )}
          {confirmError && <FormAlert>{confirmError}</FormAlert>}
          <div className="space-y-xs">
            <label htmlFor="payMethod" className={labelStyles}>Method</label>
            <select id="payMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputStyles()}>
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
              <option value="Maya">Maya</option>
              <option value="BankTransfer">Bank transfer</option>
            </select>
          </div>
          <div className="space-y-xs">
            <label htmlFor="payAmount" className={labelStyles}>Amount received (₱)</label>
            <input id="payAmount" inputMode="decimal" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} className={inputStyles("tabular-nums")} />
          </div>
          <div className="space-y-xs">
            <label htmlFor="payRef" className={labelStyles}>Reference number <span className="font-normal text-on-surface-variant">(optional)</span></label>
            <input id="payRef" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={inputStyles("font-mono")} />
          </div>
          <div className="space-y-xs">
            <label htmlFor="payNotes" className={labelStyles}>Notes <span className="font-normal text-on-surface-variant">(optional)</span></label>
            <input id="payNotes" value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} className={inputStyles()} />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
