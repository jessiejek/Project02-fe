"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
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
  const activeBooking = useMemo(() => queue.find((q) => q.id === activeId) ?? null, [queue, activeId]);

  const totalDue = queue.reduce((sum, b) => sum + b.amountDue, 0);

  async function load() {
    const supabase = null as never;
    const board = await queryQueue(supabase);
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
    load();
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
    const supabase = null as never;
    await confirmPaymentApi(supabase, activeBooking.id, {
      paymentMethod,
      amountReceived: Number(amountReceived) || activeBooking.amountDue,
      referenceNumber: referenceNumber.trim() || null,
      confirmNotes: confirmNotes.trim() || null,
      orNumber: newOrNumber(activeBooking.id),
    });

    setQueue((prev) => prev.filter((b) => b.id !== activeBooking.id));
    setSubmitting(false);
    setActiveId(null);
    setPaymentMethod("Cash");
    setAmountReceived("");
    setReferenceNumber("");
    setConfirmNotes("");
  }

  if (loading) {
    return (
      <AppShell role="staff">
        <SkeletonTable rows={6} columns={5} />
      </AppShell>
    );
  }

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Payments / Collection Queue</h2>

        <div className="flex flex-wrap gap-md">
          <Card className="flex-1">
            <p className="text-label-sm uppercase text-on-surface-variant">Ready to collect</p>
            <p className="text-headline-lg text-on-surface">{queue.length}</p>
          </Card>
          <Card className="flex-1">
            <p className="text-label-sm uppercase text-on-surface-variant">Total due</p>
            <p className="text-headline-lg text-on-surface">₱{totalDue.toLocaleString()}</p>
          </Card>
        </div>

        <DataTable
          columns={[
            {
              header: "Patient",
              render: (r) => (
                <>
                  {r.patientName}
                  {r.patientCode ? <span className="text-on-surface-variant"> ({r.patientCode})</span> : null}
                </>
              ),
            },
            { header: "Date / Queue #", render: (r) => `${r.appointmentDate} · ${r.queueNumber ?? "—"}` },
            { header: "Amount Due", align: "right", render: (r) => `₱${r.amountDue}` },
            {
              header: "Action",
              align: "right",
              render: (r) => (
                <Button
                  onClick={() => {
                    setActiveId(r.id);
                    setAmountReceived(String(r.amountDue));
                  }}
                >
                  Confirm Payment
                </Button>
              ),
            },
          ]}
          rows={queue}
          rowKey={(r) => r.id}
          emptyMessage="No payments pending collection."
          renderMobileCard={(r) => (
            <div className="space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-body-md font-medium text-on-surface">
                    {r.patientName}
                    {r.patientCode ? ` (${r.patientCode})` : ""}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {r.appointmentDate} · Q#{r.queueNumber ?? "—"}
                  </p>
                </div>
                <p className="text-body-md font-medium text-on-surface">₱{r.amountDue}</p>
              </div>
              <Button
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveId(r.id);
                  setAmountReceived(String(r.amountDue));
                }}
              >
                Confirm Payment
              </Button>
            </div>
          )}
        />
      </div>

      <Modal
        isOpen={activeId !== null}
        onClose={() => setActiveId(null)}
        title="Confirm Payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveId(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={submitting || !activeBooking}>
              {submitting ? "Confirming..." : "Confirm"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {activeBooking && (
            <p className="text-body-md text-on-surface">
              <strong>Patient:</strong> {activeBooking.patientName}
              {activeBooking.patientCode ? ` (${activeBooking.patientCode})` : ""}
            </p>
          )}
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm">
            <option>Cash</option>
            <option>GCash</option>
            <option>Maya</option>
            <option>BankTransfer</option>
          </select>
          <input
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            placeholder="Amount Received"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Reference Number (optional)"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <input
            value={confirmNotes}
            onChange={(e) => setConfirmNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
      </Modal>
    </AppShell>
  );
}
