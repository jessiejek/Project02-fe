"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { one, serviceNames } from "@/lib/one";

interface QueueRow {
  id: string;
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
      const supabase = createClient();
      const { data } = await supabase
        .from("bookings")
        .select("booking_id, appointment_date, queue_number, amount_due, status, doctors(staff_accounts(full_name)), booking_services(services(name)), payments(status)")
        .eq("status", "Completed")
        .order("appointment_date", { ascending: true })
        .order("queue_number", { ascending: true, nullsFirst: false });

      const mapped: QueueRow[] = (data ?? [])
        .map((b) => {
          const doctor = one(b.doctors);
          const staff = one(doctor?.staff_accounts);
          const payment = one(b.payments);
          const row: QueueRowWithPayment = {
            id: b.booking_id,
            doctorName: staff?.full_name ?? "",
            serviceNames: serviceNames(b.booking_services),
            appointmentDate: b.appointment_date,
            queueNumber: b.queue_number,
            amountDue: Number(b.amount_due),
            paymentStatus: payment?.status ?? "Unpaid",
          };
          return row;
        })
        .filter((row) => row.paymentStatus === "Unpaid")
        .map(({ paymentStatus: _paymentStatus, ...row }) => row);

      setQueue(mapped);
      setLoading(false);
    }

    load();
  }, []);

  async function confirmPayment() {
    if (!activeBooking) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .from("payments")
      .update({
        status: "Paid",
        payment_method: paymentMethod,
        amount_received: Number(amountReceived) || activeBooking.amountDue,
        reference_number: referenceNumber.trim() || null,
        confirm_notes: confirmNotes.trim() || null,
        confirmed_at: new Date().toISOString(),
        or_number: newOrNumber(activeBooking.id),
      })
      .eq("booking_id", activeBooking.id);

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
        <p className="text-body-md text-on-surface-variant">Loading payment queue...</p>
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
                  <p className="text-body-md font-medium text-on-surface">{r.doctorName}</p>
                  <p className="text-label-sm text-on-surface-variant">{r.serviceNames.join(", ")}</p>
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
            <Button onClick={confirmPayment} disabled={submitting || !activeBooking}>
              {submitting ? "Confirming..." : "Confirm"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
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
