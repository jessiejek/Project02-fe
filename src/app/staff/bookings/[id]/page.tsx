"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { queryBookingById, updateBookingStatus } from "@/lib/data/bookings";
import { confirmPayment, waivePayment } from "@/lib/data/payments";

interface BookingView {
  id: string;
  patientName: string;
  patientCode: string;
  patientContact: string;
  patientEmail: string;
  patientSex: string;
  patientDob: string;
  doctorName: string;
  doctorSpecialization: string;
  appointmentDate: string;
  slotStartTime: string;
  status: string;
  queueNumber: string | null;
  paymentMode: string;
  amountDue: number;
  paymentStatus: string;
  orNumber: string | null;
  waivedReason: string | null;
}

function newOrNumber(bookingId: string) {
  return `OR-${bookingId.slice(0, 8).toUpperCase()}`;
}

// Stitch booking_detail_states (staff) — 5 states driven by booking status/
// payment status, per React-Conversion-Guide.md §4 (one component, variant
// from data, not 5 separate components). Real bookings/payments split
// mirrors admin/bookings/[id]/page.tsx's already-established pattern.
export default function StaffBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined);
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [reasonText, setReasonText] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const b = await queryBookingById(supabase, id);
      if (!b) {
        setBooking(null);
        return;
      }
      setBooking({
        id: b.booking_id,
        patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
        patientCode: b.patients?.patient_code ?? "",
        patientContact: b.patients?.contact_number ?? "",
        patientEmail: b.patients?.email ?? "",
        patientSex: b.patients?.sex ?? "",
        patientDob: b.patients?.date_of_birth ?? "",
        doctorName: b.doctors?.staff_accounts?.full_name ?? "",
        doctorSpecialization: b.doctors?.specialization ?? "",
        appointmentDate: b.appointment_date,
        slotStartTime: b.slot_start_time.slice(0, 5),
        status: b.status,
        queueNumber: b.queue_number,
        paymentMode: b.payment_mode,
        amountDue: Number(b.amount_due),
        paymentStatus: b.payments?.status ?? "Unpaid",
        orNumber: b.payments?.or_number ?? null,
        waivedReason: b.payments?.waived_reason ?? null,
      });
      setAmountReceived(String(b.amount_due));
    }
    load();
  }, [id]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="staff">
        <p className="text-body-md text-on-surface-variant">Loading booking…</p>
      </AppShell>
    );
  }

  async function updateBooking(patch: { status?: string; cancellationReason?: string }) {
    const supabase = null as never;
    if (patch.status) await updateBookingStatus(supabase, id, patch.status, { reason: patch.cancellationReason });
    setBooking((prev) => (prev ? { ...prev, ...(patch.status && { status: patch.status }) } : prev));
  }

  async function updatePayment(patch: {
    status: string;
    paymentMethod?: string;
    amountReceived?: number;
    confirmNotes?: string;
    waivedReason?: string;
    withOrNumber?: boolean;
  }) {
    const supabase = null as never;
    const orNumber = patch.withOrNumber ? newOrNumber(id) : undefined;
    if (patch.status === "Waived") {
      await waivePayment(supabase, id, patch.waivedReason ?? "");
    } else {
      await confirmPayment(supabase, id, {
        paymentMethod: patch.paymentMethod ?? "Cash",
        amountReceived: patch.amountReceived ?? booking!.amountDue,
        confirmNotes: patch.confirmNotes,
        orNumber,
      });
    }
    setBooking((prev) =>
      prev ? { ...prev, paymentStatus: patch.status, orNumber: orNumber ?? prev.orNumber, waivedReason: patch.waivedReason ?? prev.waivedReason } : prev,
    );
  }

  const isConfirmed = booking.status === "Confirmed";
  const isCheckedIn = booking.status === "CheckedIn";
  const isCompletedUnpaid = booking.status === "Completed" && booking.paymentStatus === "Unpaid";
  const isCompleted = booking.status === "Completed";

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        {/* Patient card — Staff.md §3: name, code, contact, email, sex, DOB */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Patient</h2>
          <div className="grid grid-cols-2 gap-md text-body-md sm:grid-cols-3">
            <Field label="Name" value={booking.patientName} />
            <Field label="Code" value={booking.patientCode} />
            <Field label="Sex" value={booking.patientSex} />
            <Field label="Date of Birth" value={booking.patientDob} />
            <Field label="Contact" value={booking.patientContact} />
            <Field label="Email" value={booking.patientEmail} />
          </div>
        </Card>

        {/* Doctor card — distinct from Patient card per Staff.md §3 */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Doctor</h2>
          <div className="grid grid-cols-2 gap-md text-body-md">
            <Field label="Name" value={booking.doctorName} />
            <Field label="Specialization" value={booking.doctorSpecialization} />
          </div>
        </Card>

        <Card>
          <div className="mb-md flex items-start justify-between">
            <div>
              <h2 className="text-headline-sm text-on-surface">Appointment</h2>
            </div>
            <StatusPill status={booking.status} />
          </div>
          <div className="flex flex-wrap gap-md text-label-md text-on-surface-variant">
            <span>{booking.appointmentDate}</span>
            <span>{booking.slotStartTime}</span>
            {booking.queueNumber && <span>Queue #{booking.queueNumber}</span>}
          </div>
        </Card>

        {/* Payment info — Staff.md §3: mode, status, amount, OR number, waive reason */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Payment</h2>
          <div className="grid grid-cols-2 gap-md text-body-md">
            <Field label="Mode" value={booking.paymentMode === "PayAtClinic" ? "Pay at Clinic" : "Online"} />
            <div>
              <p className="text-label-sm text-on-surface-variant">Status</p>
              <StatusPill status={booking.paymentStatus} />
            </div>
            <Field label="Amount Due" value={`₱${booking.amountDue}`} />
            {(booking.paymentStatus === "Paid" || booking.paymentStatus === "Waived") && booking.orNumber && (
              <Field label="OR Number" value={booking.orNumber} />
            )}
          </div>
          {booking.paymentStatus === "Waived" && booking.waivedReason && (
            <p className="mt-md rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
              Professional fee waived: {booking.waivedReason}
            </p>
          )}
        </Card>

        <Card className="flex flex-wrap gap-md">
          {isConfirmed && <Button onClick={() => updateBooking({ status: "CheckedIn" })}>Check In</Button>}
          {isCheckedIn && (
            <Button variant="secondary" onClick={() => updateBooking({ status: "Confirmed" })}>
              Undo Check-In
            </Button>
          )}
          {isCompletedUnpaid && (
            <>
              <Button onClick={() => setConfirmPaymentOpen(true)}>Confirm Payment</Button>
              <Button variant="secondary" onClick={() => setWaiveOpen(true)}>
                Waive Professional Fee
              </Button>
            </>
          )}
          {isCompleted && (booking.paymentStatus === "Paid" || booking.paymentStatus === "Waived") && (
            <Button variant="secondary" onClick={() => setReceiptOpen(true)}>
              Print Document
            </Button>
          )}
          {(isConfirmed || isCheckedIn) && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel Booking
            </Button>
          )}
        </Card>
      </div>

      <Modal
        isOpen={confirmPaymentOpen}
        onClose={() => setConfirmPaymentOpen(false)}
        title="Confirm Payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await updatePayment({
                  status: "Paid",
                  paymentMethod: paymentMethod,
                  amountReceived: Number(amountReceived) || booking.amountDue,
                  confirmNotes: notes || undefined,
                  withOrNumber: true,
                });
                setConfirmPaymentOpen(false);
                setReceiptOpen(true);
              }}
            >
              Confirm
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
          <input placeholder="Amount Received" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          <input placeholder="Reference Number (optional)" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
        </div>
      </Modal>

      <Modal
        isOpen={waiveOpen}
        onClose={() => { setWaiveOpen(false); setReasonText(""); }}
        title="Waive Professional Fee"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setWaiveOpen(false); setReasonText(""); }}>
              Cancel
            </Button>
            <Button
              disabled={reasonText.trim().length < 5}
              onClick={async () => {
                await updatePayment({ status: "Waived", waivedReason: reasonText, withOrNumber: true });
                setWaiveOpen(false);
                setReasonText("");
              }}
            >
              Confirm Waiver
            </Button>
          </>
        }
      >
        <textarea
          placeholder="Reason (minimum 5 characters)"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          className="w-full rounded-lg border border-outline-variant p-md"
          rows={3}
        />
      </Modal>

      <Modal
        isOpen={cancelOpen}
        onClose={() => { setCancelOpen(false); setReasonText(""); }}
        title="Cancel Booking"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCancelOpen(false); setReasonText(""); }}>
              Keep Booking
            </Button>
            <Button
              variant="danger"
              disabled={reasonText.trim().length < 5}
              onClick={async () => {
                await updateBooking({ status: "Cancelled", cancellationReason: reasonText });
                setCancelOpen(false);
                setReasonText("");
              }}
            >
              Confirm Cancel
            </Button>
          </>
        }
      >
        <textarea
          placeholder="Reason (minimum 5 characters)"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          className="w-full rounded-lg border border-outline-variant p-md"
          rows={3}
        />
      </Modal>

      {/* Receipt/print modal — Staff.md §3: OR number, patient/doctor, services,
          date, amount, method, reference, staff name, timestamp. */}
      <Modal isOpen={receiptOpen} onClose={() => setReceiptOpen(false)} title="Receipt" footer={<Button onClick={() => setReceiptOpen(false)}>Close</Button>}>
        <div className="space-y-sm text-body-md">
          <p className="text-center text-headline-sm text-on-surface">OR #{booking.orNumber ?? "—"}</p>
          <div className="border-t border-outline-variant pt-sm">
            <Field label="Patient" value={booking.patientName} />
            <Field label="Doctor" value={booking.doctorName} />
            <Field label="Date" value={booking.appointmentDate} />
            <Field label="Amount" value={`₱${booking.amountDue}`} />
            <Field label="Method" value={paymentMethod} />
            {referenceNumber && <Field label="Reference #" value={referenceNumber} />}
            <Field label="Timestamp" value={new Date().toLocaleString()} />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-body-md text-on-surface">{value}</p>
    </div>
  );
}
