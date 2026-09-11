"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BookingTimeline } from "@/components/ui/BookingTimeline";
import { queryBookingById, updateBookingStatus } from "@/lib/data/bookings";
import { waivePayment, refundPayment } from "@/lib/data/payments";
import { printHtml, escapeHtml } from "@/lib/print";

const TIMELINE = ["Pending", "ProofSubmitted", "Confirmed", "Completed"];

interface BookingView {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  patientContact: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  appointmentDate: string;
  status: string;
  paymentMode: string;
  amountDue: number;
  paymentStatus: string;
  orNumber: string | null;
}

function newOrNumber(bookingId: string) {
  return `OR-${bookingId.slice(0, 8).toUpperCase()}`;
}

// Stitch booking_detail_states_admin — 6 states driven by booking/payment
// status, per React-Conversion-Guide.md §4. The most complex single screen
// in the app per Stitch-04's own goal statement. `bookings` and `payments`
// are two separate real tables (Database-Schema-Design.md §D — payment
// state deliberately never lives on `bookings`), so writes are split into
// updateBooking()/updatePayment() instead of the old single update() helper.
export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined);
  const [reasonModal, setReasonModal] = useState<"confirm" | "reject" | "cancel" | null>(null);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

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
        patientId: b.patient_id,
        patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "",
        patientCode: b.patients?.patient_code ?? "",
        patientContact: b.patients?.contact_number ?? "",
        patientEmail: b.patients?.email ?? "",
        doctorId: b.doctor_id,
        doctorName: b.doctors?.staff_accounts?.full_name ?? "",
        doctorSpecialization: b.doctors?.specialization ?? "",
        appointmentDate: b.appointment_date,
        status: b.status,
        paymentMode: b.payment_mode,
        amountDue: Number(b.amount_due),
        paymentStatus: b.payments?.status ?? "Unpaid",
        orNumber: b.payments?.or_number ?? null,
      });
    }
    load();
  }, [id]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="admin">
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
    waivedReason?: string;
    refundReason?: string;
    refundAmount?: number;
    withOrNumber?: boolean;
  }) {
    const supabase = null as never;
    const orNumber = patch.withOrNumber ? newOrNumber(id) : undefined;
    if (patch.status === "Refunded") {
      await refundPayment(supabase, id, {
        amount: patch.refundAmount ?? 0,
        reason: patch.refundReason ?? "",
      });
    } else if (patch.status === "Waived") {
      await waivePayment(supabase, id, patch.waivedReason ?? "");
    }
    setBooking((prev) => (prev ? { ...prev, paymentStatus: patch.status, orNumber: orNumber ?? prev.orNumber } : prev));
  }

  const timelineIndex = TIMELINE.indexOf(booking.status);

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        {/* Patient/Doctor/Appointment/Payment info cards — admin.md §3 */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Patient</h2>
          <div className="grid grid-cols-2 gap-md text-body-md sm:grid-cols-3">
            <InfoField label="Name" value={booking.patientName} />
            <InfoField label="Code" value={booking.patientCode} />
            <InfoField label="Contact" value={booking.patientContact} />
            <InfoField label="Email" value={booking.patientEmail} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Doctor</h2>
          <div className="grid grid-cols-2 gap-md text-body-md">
            <InfoField label="Name" value={booking.doctorName} />
            <InfoField label="Specialization" value={booking.doctorSpecialization} />
          </div>
        </Card>

        <Card>
          <div className="mb-md flex items-start justify-between">
            <div>
              <h2 className="text-headline-sm text-on-surface">Visit</h2>
            </div>
            <StatusPill status={booking.status} />
          </div>
          <div className="mb-md">
            <BookingTimeline steps={TIMELINE} currentIndex={timelineIndex} />
          </div>
          <div className="flex flex-wrap gap-md text-label-md text-on-surface-variant">
            <span>{booking.appointmentDate}</span>
            <StatusPill status={booking.paymentStatus} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Payment</h2>
          <div className="grid grid-cols-2 gap-md text-body-md sm:grid-cols-3">
            <InfoField label="Mode" value={booking.paymentMode === "PayAtClinic" ? "Pay at Clinic" : "Online"} />
            <InfoField label="Amount Due" value={`₱${booking.amountDue}`} />
            {(booking.paymentStatus === "Paid" || booking.paymentStatus === "Waived") && booking.orNumber && (
              <InfoField label="OR Number" value={booking.orNumber} />
            )}
          </div>
        </Card>

        <Card className="flex flex-wrap gap-md">
          {booking.status === "Pending" && (
            <>
              <Button onClick={() => updateBooking({ status: "Confirmed" })}>Confirm Booking</Button>
              <Button variant="danger" onClick={() => setReasonModal("reject")}>Reject Booking</Button>
            </>
          )}
          {booking.status === "ProofSubmitted" && (
            <>
              <Button
                onClick={async () => {
                  await updateBooking({ status: "Confirmed" });
                  await updatePayment({ status: "Paid", withOrNumber: true });
                }}
              >
                Confirm Payment
              </Button>
              <Button variant="danger" onClick={() => setReasonModal("reject")}>Reject Proof</Button>
            </>
          )}
          {booking.status === "Confirmed" && (
            <>
              <Button onClick={() => updateBooking({ status: "Completed" })}>Mark Complete</Button>
              <Button variant="secondary" onClick={() => updateBooking({ status: "NoShow" })}>Mark No Show</Button>
              <Button variant="secondary" onClick={() => updateBooking({ status: "Rescheduled" })}>Reschedule</Button>
              <Button variant="danger" onClick={() => setReasonModal("cancel")}>Cancel Booking</Button>
            </>
          )}
          {booking.status === "Completed" && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  printHtml(
                    `Receipt ${booking.orNumber ?? booking.id}`,
                    `<h1>Official Receipt</h1>
                     <p class="meta">${escapeHtml(booking.orNumber ?? "—")}</p>
                     <div class="card">
                       <p><strong>Patient:</strong> ${escapeHtml(booking.patientName)}</p>
                       <p><strong>Doctor:</strong> ${escapeHtml(booking.doctorName)}</p>
                       <p><strong>Date:</strong> ${escapeHtml(booking.appointmentDate)}</p>
                       <p><strong>Amount:</strong> ₱${escapeHtml(String(booking.amountDue))}</p>
                       <p><strong>Payment:</strong> ${escapeHtml(booking.paymentStatus)}</p>
                     </div>`,
                  );
                }}
              >
                Print Receipt
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  printHtml(
                    `Visit Summary ${booking.id}`,
                    `<h1>Visit Summary</h1>
                     <p class="meta">${escapeHtml(booking.appointmentDate)} · ${escapeHtml(booking.status)}</p>
                     <div class="card">
                       <p><strong>Patient:</strong> ${escapeHtml(booking.patientName)} (${escapeHtml(booking.patientCode)})</p>
                       <p><strong>Doctor:</strong> ${escapeHtml(booking.doctorName)} — ${escapeHtml(booking.doctorSpecialization)}</p>
                       <p><strong>Amount due:</strong> ₱${escapeHtml(String(booking.amountDue))}</p>
                       <p><strong>Payment:</strong> ${escapeHtml(booking.paymentStatus)}${booking.orNumber ? ` · ${escapeHtml(booking.orNumber)}` : ""}</p>
                     </div>`,
                  );
                }}
              >
                Print Visit Summary
              </Button>
            </>
          )}
          {booking.paymentStatus === "Unpaid" && <Button variant="secondary" onClick={() => setWaiveOpen(true)}>Waive Payment</Button>}
          {booking.paymentStatus === "Paid" && <Button variant="secondary" onClick={() => setRefundOpen(true)}>Refund Payment</Button>}
        </Card>
      </div>

      <Modal
        isOpen={reasonModal !== null}
        onClose={() => { setReasonModal(null); setReasonText(""); }}
        title={reasonModal === "cancel" ? "Cancel Booking" : "Reject"}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setReasonModal(null); setReasonText(""); }}>Back</Button>
            <Button
              variant="danger"
              disabled={!reasonText.trim()}
              onClick={async () => {
                // Patient.md's BookingStatus enum has no separate "Rejected" value,
                // so Reject Booking/Reject Proof/Cancel Booking all terminate in
                // "Cancelled" — the only terminal-negative status that exists.
                // Open question (not resolved here, per Gaps.md's own rule against
                // guessing): should "Reject Proof" instead revert the booking to
                // "Pending" so the patient can resubmit, rather than cancelling
                // outright? Left as Cancelled until that's confirmed.
                await updateBooking({ status: "Cancelled", cancellationReason: reasonText });
                setReasonModal(null);
                setReasonText("");
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <textarea
          placeholder="Reason (required)"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          className="w-full rounded-lg border border-outline-variant p-md"
          rows={3}
        />
      </Modal>

      <Modal
        isOpen={waiveOpen}
        onClose={() => { setWaiveOpen(false); setReasonText(""); }}
        title="Waive Payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setWaiveOpen(false); setReasonText(""); }}>Cancel</Button>
            <Button
              disabled={!reasonText.trim()}
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
          placeholder="Reason (required)"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          className="w-full rounded-lg border border-outline-variant p-md"
          rows={3}
        />
      </Modal>

      <Modal
        isOpen={refundOpen}
        onClose={() => { setRefundOpen(false); setReasonText(""); setRefundAmount(""); }}
        title="Refund Payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRefundOpen(false); setReasonText(""); setRefundAmount(""); }}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reasonText.trim() || !refundAmount.trim()}
              onClick={async () => {
                await updatePayment({ status: "Refunded", refundReason: reasonText, refundAmount: Number(refundAmount) || 0 });
                setRefundOpen(false);
                setReasonText("");
                setRefundAmount("");
              }}
            >
              Confirm Refund
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          <textarea
            placeholder="Reason (required)"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            className="w-full rounded-lg border border-outline-variant p-md"
            rows={3}
          />
          <input
            placeholder="Amount"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
      </Modal>
    </AppShell>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-body-md text-on-surface">{value}</p>
    </div>
  );
}
