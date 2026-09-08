"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BookingTimeline } from "@/components/ui/BookingTimeline";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";

const TIMELINE = ["Pending", "Confirmed", "CheckedIn", "Completed"];

interface BookingView {
  id: string;
  doctorName: string;
  serviceNames: string[];
  appointmentDate: string;
  slotStartTime: string;
  slotEndTime: string;
  status: string;
  queueNumber: string | null;
  amountDue: number;
  totalFee: number;
  paymentStatus: string;
  paymentMode: string;
  waivedReason: string | null;
  createdAt: string;
}

// Stitch screen_14_booking_detail_states — 4 states driven by the booking's
// actual status/paymentStatus (per React-Conversion-Guide.md §4: one
// component with a variant derived from data, not 4 separate components).
export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session } = useSession();
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    // Ownership gate: only load once we know who the patient is, and only
    // return a booking that belongs to them (same idea as doctor appointments
    // scoping by doctor_id). Without this, any authenticated patient who
    // guessed a booking UUID could read another patient's visit details.
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = createClient();
      const bookingRes = await supabase
        .from("bookings")
        .select("*, doctors(staff_accounts(full_name))")
        .eq("booking_id", id)
        .eq("patient_id", patientId)
        .maybeSingle();
      if (!bookingRes.data) {
        setBooking(null);
        return;
      }
      const [servicesRes, paymentRes] = await Promise.all([
        supabase.from("booking_services").select("services(name)").eq("booking_id", id),
        supabase.from("payments").select("status, waived_reason").eq("booking_id", id).maybeSingle(),
      ]);
      const b = bookingRes.data;
      const doctor = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
      const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
      const payment = paymentRes.data;
      setBooking({
        id: b.booking_id,
        doctorName: staff?.full_name ?? "",
        serviceNames: (servicesRes.data ?? []).map((s) => {
          const service = Array.isArray(s.services) ? s.services[0] : s.services;
          return service?.name ?? "";
        }),
        appointmentDate: b.appointment_date,
        slotStartTime: b.slot_start_time.slice(0, 5),
        slotEndTime: b.slot_end_time.slice(0, 5),
        status: b.status,
        queueNumber: b.queue_number,
        amountDue: Number(b.amount_due),
        totalFee: Number(b.total_fee),
        paymentStatus: payment?.status ?? "Unpaid",
        paymentMode: b.payment_mode,
        waivedReason: payment?.waived_reason ?? null,
        createdAt: b.created_at.slice(0, 10),
      });
    }
    load();
  }, [id, session?.patientId]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading booking…</p>
      </AppShell>
    );
  }

  async function handleCancel() {
    setActionError("");
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "Cancelled",
        cancellation_reason: cancelReason.trim() || null,
      })
      .eq("booking_id", id)
      .eq("patient_id", session!.patientId!);
    setSubmitting(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setBooking((prev) => (prev ? { ...prev, status: "Cancelled" } : prev));
    setCancelOpen(false);
    setCancelReason("");
  }

  async function handleSubmitProof() {
    if (!referenceNumber.trim()) {
      setActionError("Reference number is required.");
      return;
    }
    setActionError("");
    setSubmitting(true);
    const supabase = createClient();
    const [{ error: bookingError }, { error: paymentError }] = await Promise.all([
      supabase
        .from("bookings")
        .update({
          status: "ProofSubmitted",
          proof_type: "ReferenceNumber",
          proof_value: referenceNumber.trim(),
        })
        .eq("booking_id", id)
        .eq("patient_id", session!.patientId!),
      supabase
        .from("payments")
        .update({ reference_number: referenceNumber.trim() })
        .eq("booking_id", id),
    ]);
    setSubmitting(false);
    if (bookingError || paymentError) {
      setActionError(bookingError?.message ?? paymentError?.message ?? "Could not submit payment proof.");
      return;
    }
    setBooking((prev) => (prev ? { ...prev, status: "ProofSubmitted" } : prev));
    setProofOpen(false);
    setReferenceNumber("");
  }

  const isClosed = ["Cancelled", "NoShow", "Expired"].includes(booking.status);
  const isUpcoming = ["Confirmed", "CheckedIn"].includes(booking.status);
  const isCompleted = booking.status === "Completed";
  // Patient.md §7's actual documented conditions — previously this checked
  // status==="Completed" for both, which doesn't match either spec'd rule
  // (found during the flow-completeness audit).
  const canShowReceipt = ["Paid", "Waived"].includes(booking.paymentStatus);
  const canSubmitProof =
    booking.paymentMode === "Online" &&
    booking.paymentStatus === "Unpaid" &&
    ["Pending", "OnHold"].includes(booking.status);
  const timelineIndex = TIMELINE.indexOf(booking.status);
  const orNumber = `OR-${booking.id.toUpperCase()}`;

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        {isClosed && (
          <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
            This booking is no longer active.
          </p>
        )}

        <Card>
          <div className="mb-md flex items-start justify-between">
            <div>
              <h1 className="text-headline-md text-on-surface">{booking.doctorName}</h1>
              <p className="text-body-md text-on-surface-variant">{booking.serviceNames.join(", ")}</p>
            </div>
            <StatusPill status={booking.status} />
          </div>
          <div className="mb-md flex flex-wrap gap-md text-label-md text-on-surface-variant">
            <span>{booking.appointmentDate}</span>
            <span>{booking.slotStartTime} - {booking.slotEndTime}</span>
            {booking.queueNumber && <span>Queue #{booking.queueNumber}</span>}
          </div>

          {!isClosed && (
            <div className="mb-md">
              <BookingTimeline steps={TIMELINE} currentIndex={timelineIndex} />
            </div>
          )}

          <div className="mb-md flex flex-wrap items-center gap-sm text-body-md">
            <span className="font-bold">Amount Due:</span> ₱{booking.amountDue}
            <StatusPill status={booking.paymentStatus} />
            {booking.paymentStatus === "Waived" && booking.waivedReason && (
              <span className="text-label-sm text-on-surface-variant">
                (PF waived: {booking.waivedReason})
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-md text-label-sm text-on-surface-variant">
            <span>Payment mode: {booking.paymentMode === "PayAtClinic" ? "Pay at Clinic" : "Online"}</span>
            <span>Created: {booking.createdAt}</span>
          </div>
        </Card>

        {canShowReceipt && (
          <Card className="flex flex-wrap items-center justify-between gap-md">
            <p className="text-body-md text-on-surface">Receipt available</p>
            <Button variant="secondary" onClick={() => setReceiptOpen(true)}>
              View / Print Receipt
            </Button>
          </Card>
        )}

        {isCompleted && (
          <Card className="flex flex-wrap items-center justify-between gap-md">
            <div>
              <h3 className="text-headline-sm text-on-surface">How was your visit?</h3>
              <p className="text-label-md text-on-surface-variant">Share your experience with {booking.doctorName}.</p>
            </div>
            <Link href={`/patient/reviews/${booking.id}`}>
              <Button>Leave a Review</Button>
            </Link>
          </Card>
        )}

        {canSubmitProof && (
          <Card className="flex flex-wrap items-center justify-between gap-md">
            <p className="text-body-md text-on-surface">Payment not yet collected.</p>
            <Button onClick={() => setProofOpen(true)}>Submit Payment Proof</Button>
          </Card>
        )}

        {isUpcoming && (
          <Card>
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel Booking
            </Button>
          </Card>
        )}

        {!isClosed && (
          <div className="flex flex-col gap-sm text-label-md text-primary sm:flex-row sm:gap-lg">
            <Link href="/patient/documents" className="hover:underline">
              Jump to My Documents
            </Link>
            <Link href="/patient/lab-results" className="hover:underline">
              Jump to My Labs
            </Link>
          </div>
        )}
        {isClosed && (
          <div className="flex flex-col gap-sm text-label-md text-primary sm:flex-row sm:gap-lg">
            <Link href="/patient/documents" className="hover:underline">
              My Documents
            </Link>
            <Link href="/patient/lab-results" className="hover:underline">
              My Labs
            </Link>
          </div>
        )}
      </div>

      <Modal
        isOpen={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setCancelReason("");
          setActionError("");
        }}
        title="Cancel Booking"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCancelOpen(false);
                setCancelReason("");
                setActionError("");
              }}
              disabled={submitting}
            >
              Keep Booking
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={submitting}>
              {submitting ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </>
        }
      >
        <p className="mb-md text-body-md text-on-surface-variant">Are you sure you want to cancel this booking?</p>
        {actionError && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{actionError}</p>}
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full rounded-lg border border-outline-variant p-md text-body-md"
          rows={3}
        />
      </Modal>

      <Modal
        isOpen={proofOpen}
        onClose={() => {
          setProofOpen(false);
          setReferenceNumber("");
          setActionError("");
        }}
        title="Submit Payment Proof"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setProofOpen(false);
                setReferenceNumber("");
                setActionError("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitProof} disabled={submitting || !referenceNumber.trim()}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {actionError && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{actionError}</p>}
          <input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Reference Number"
            className="w-full rounded-lg border border-outline-variant px-md py-md"
          />
          <div className="rounded-lg border border-dashed border-outline-variant p-lg text-center text-body-md text-on-surface-variant">
            Screenshot upload comes in Phase 6 (Storage). Reference number is enough for now.
          </div>
        </div>
      </Modal>

      {/* Patient.md §7: "modal with OR number, names, services, amount,
          method, reference, cashier, waived reason." */}
      <Modal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Receipt"
        footer={<Button onClick={() => setReceiptOpen(false)}>Close</Button>}
      >
        <div className="space-y-sm text-body-md">
          <p className="text-center text-headline-sm text-on-surface">OR #{orNumber}</p>
          <div className="border-t border-outline-variant pt-sm">
            <ReceiptField label="Doctor" value={booking.doctorName} />
            <ReceiptField label="Services" value={booking.serviceNames.join(", ")} />
            <ReceiptField label="Date" value={booking.appointmentDate} />
            <ReceiptField label="Amount" value={`₱${booking.totalFee}`} />
            <ReceiptField label="Method" value={booking.paymentMode === "PayAtClinic" ? "Pay at Clinic" : "Online"} />
            {booking.waivedReason && (
              <ReceiptField label="Waived Reason" value={booking.waivedReason} />
            )}
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-body-md text-on-surface">{value}</p>
    </div>
  );
}
