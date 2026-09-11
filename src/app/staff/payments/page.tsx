"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { queryBookings } from "@/lib/data/bookings";
import { confirmPayment as confirmPaymentApi } from "@/lib/data/payments";
import { one, serviceNames } from "@/lib/one";

interface QueueRow {
  id: string;
  patientName: string;
  patientCode: string;
  doctorName: string;
  serviceNames: string[];
  appointmentDate: string;
  queueNumber: string | null;
  amountDue: number;
}

interface QueueRowWithPayment extends QueueRow {
  paymentStatus: string;
}

function newOrNumber(bookingId: string) {
  return `OR-${bookingId.slice(0, 8).toUpperCase()}`;
}

// Stitch payments_queue — pre-filtered to Completed + Unpaid, per Staff.md §4.
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

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const rows = await queryBookings(supabase, { status: "Completed" });
      const mapped: QueueRow[] = rows
        .filter((b) => (b.payments?.status ?? "Unpaid") === "Unpaid")
        .map((b) => ({
          id: b.booking_id,
          patientName: [b.patients?.first_name, b.patients?.last_name].filter(Boolean).join(" ") || "—",
          patientCode: b.patients?.patient_code ?? "",
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
          appointmentDate: b.appointment_date,
          queueNumber: b.queue_number,
          amountDue: Number(b.amount_due),
        }));

      setQueue(mapped);
      setLoading(false);
    }

    load();
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
            { header: "Doctor", render: (r) => r.doctorName },
            { header: "Services", render: (r) => r.serviceNames.join(", ") },
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
                  <p className="text-label-sm text-on-surface-variant">{r.doctorName} · {r.serviceNames.join(", ")}</p>
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
