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
import { queryBookingById, cancelMyBooking } from "@/lib/data/bookings";
import { showPaymentStatus, isVoidBooking } from "@/lib/paymentDisplay";
import { Icon } from "@/components/ui/Icon";
import { InfoField } from "@/components/ui/InfoField";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatClockTime, formatPeso } from "@/lib/format";

const TIMELINE = ["Pending", "Confirmed", "CheckedIn", "Completed"];

interface BookingView {
  id: string;
  doctorName: string;
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
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // Ownership gate: only load once we know who the patient is, and only
    // return a booking that belongs to them (same idea as doctor appointments
    // scoping by doctor_id). Without this, any authenticated patient who
    // guessed a booking UUID could read another patient's visit details.
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = null as never;
      let b;
      try {
        b = await queryBookingById(supabase, id);
        setLoadError(false);
      } catch {
        setLoadError(true);
        return;
      }
      if (!b || b.patient_id !== patientId) {
        setBooking(null);
        return;
      }
      setBooking({
        id: b.booking_id,
        doctorName: b.doctors?.staff_accounts?.full_name ?? "",
        appointmentDate: b.appointment_date,
        slotStartTime: b.slot_start_time.slice(0, 5),
        slotEndTime: b.slot_end_time.slice(0, 5),
        status: b.status,
        queueNumber: b.queue_number,
        amountDue: Number(b.amount_due),
        totalFee: Number(b.total_fee),
        paymentStatus: b.payments?.status ?? "Unpaid",
        paymentMode: b.payment_mode,
        waivedReason: b.payments?.waived_reason ?? null,
        createdAt: b.created_at.slice(0, 10),
      });
    }
    load();
  }, [id, session?.patientId, retryKey]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="patient">
        <div className="mx-auto max-w-[40rem] space-y-lg">
          {loadError ? (
            <ErrorState title="This booking didn’t load" message="Check your connection, then try again." onRetry={() => setRetryKey((k) => k + 1)} />
          ) : (
            <div aria-busy="true" className="space-y-lg"><SkeletonCard lines={4} /><SkeletonCard lines={2} /></div>
          )}
        </div>
      </AppShell>
    );
  }

  async function handleCancel() {
    setActionError("");
    setSubmitting(true);
    try {
      await cancelMyBooking(id, cancelReason.trim() || undefined);
      const supabase = null as never;
      const b = await queryBookingById(supabase, id);
      if (b && session?.patientId && b.patient_id === session.patientId) {
        setBooking({
          id: b.booking_id,
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          appointmentDate: b.appointment_date,
          slotStartTime: b.slot_start_time.slice(0, 5),
          slotEndTime: b.slot_end_time.slice(0, 5),
          status: b.status,
          queueNumber: b.queue_number,
          amountDue: Number(b.amount_due),
          totalFee: Number(b.total_fee),
          paymentStatus: b.payments?.status ?? "Unpaid",
          paymentMode: b.payment_mode,
          waivedReason: b.payments?.waived_reason ?? null,
          createdAt: b.created_at.slice(0, 10),
        });
      } else {
        setBooking((prev) => (prev ? { ...prev, status: "Cancelled" } : prev));
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not cancel this booking.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setCancelOpen(false);
    setCancelReason("");
  }

  const isClosed = ["Cancelled", "NoShow", "Expired", "Rescheduled"].includes(booking.status);
  const canPatientCancel = booking.status === "Pending";
  const isCompleted = booking.status === "Completed";
  // Patient.md §7's actual documented conditions — previously this checked
  // status==="Completed" for both, which doesn't match either spec'd rule
  // (found during the flow-completeness audit).
  const canShowReceipt = ["Paid", "Waived"].includes(booking.paymentStatus);
  const timelineIndex = TIMELINE.indexOf(booking.status);
  const orNumber = `OR-${booking.id.toUpperCase()}`;

  const hasTime = booking.slotStartTime !== "00:00";
  const showFee = showPaymentStatus(booking.status, booking.paymentStatus);

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        <Link href="/patient/bookings" className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />
          Your bookings
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 space-y-xs">
            <h1 className="text-balance text-headline-lg-mobile text-on-surface sm:text-headline-lg">{formatClinicDate(booking.appointmentDate)}</h1>
            <p className="text-body-md tabular-nums text-on-surface-variant">
              {hasTime && <>{formatClockTime(booking.slotStartTime)}–{formatClockTime(booking.slotEndTime)} · </>}
              {booking.doctorName || "Doctor to be confirmed"}
              {booking.queueNumber && (isCompleted || isClosed) && <> · {booking.queueNumber}</>}
            </p>
          </div>
          <StatusPill status={booking.status} />
        </header>

        {isClosed && <FormAlert tone="info">This booking is no longer active.</FormAlert>}

        {booking.queueNumber && !isClosed && !isCompleted && (
          <Card className="flex items-center justify-between gap-md">
            <div>
              <p className="text-label-md text-on-surface-variant">Your queue number</p>
              <p className="whitespace-nowrap text-headline-lg tabular-nums text-primary sm:text-display-sm">{booking.queueNumber}</p>
            </div>
            <p className="max-w-[14rem] text-right text-body-sm text-on-surface-variant">Show this at the front desk when you arrive.</p>
          </Card>
        )}

        {!isClosed && (
          <Card>
            <h2 className="sr-only">Progress</h2>
            <BookingTimeline steps={TIMELINE} currentIndex={timelineIndex} />
          </Card>
        )}

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Payment</h2>
          <dl className="grid grid-cols-2 gap-md">
            {showFee ? (
              <InfoField label="Amount due" value={<span className="flex flex-wrap items-center gap-sm"><span className="tabular-nums">{formatPeso(booking.amountDue)}</span><StatusPill status={booking.paymentStatus} /></span>} className="col-span-2" />
            ) : (
              !isVoidBooking(booking.status) && (
                <InfoField label="Estimated fee" value={<><span className="tabular-nums">{formatPeso(booking.amountDue)}</span><span className="block text-label-md text-on-surface-variant">Paid at the clinic after your visit</span></>} className="col-span-2" />
              )
            )}
            <InfoField label="Payment mode" value={booking.paymentMode === "PayAtClinic" ? "Pay at clinic" : "Online"} />
            <InfoField label="Booked on" value={formatClinicDate(booking.createdAt)} />
          </dl>
          {booking.paymentStatus === "Waived" && booking.waivedReason && (
            <p className="mt-md rounded-lg bg-surface-container-low px-md py-sm text-body-sm text-on-surface">Professional fee waived: {booking.waivedReason}</p>
          )}
          {canShowReceipt && (
            <div className="mt-md border-t border-outline-variant pt-md">
              <Button variant="secondary" onClick={() => setReceiptOpen(true)}>
                <Icon name="print" className="text-[16px]" />
                View receipt
              </Button>
            </div>
          )}
        </Card>

        {isCompleted && (
          <Card className="flex flex-wrap items-center justify-between gap-md">
            <div>
              <h2 className="text-headline-sm text-on-surface">How was your visit?</h2>
              <p className="text-body-md text-on-surface-variant">Rate {booking.doctorName || "your doctor"} to help other patients.</p>
            </div>
            <Link href={`/patient/reviews/${booking.id}`} className={buttonStyles("primary")}>Leave a review</Link>
          </Card>
        )}

        <nav aria-label="Related records" className="flex flex-wrap gap-sm">
          <Link href="/patient/documents" className={buttonStyles("ghost", "!px-md")}>Documents</Link>
          <Link href="/patient/lab-results" className={buttonStyles("ghost", "!px-md")}>Lab results</Link>
          {canPatientCancel && (
            <Button variant="ghost" className="!px-md text-error sm:ml-auto" onClick={() => setCancelOpen(true)}>
              Cancel booking
            </Button>
          )}
        </nav>
      </div>

      <Modal
        isOpen={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setCancelReason("");
          setActionError("");
        }}
        title="Cancel this booking?"
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
              Keep booking
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={submitting}>
              {submitting ? "Cancelling…" : "Cancel booking"}
            </Button>
          </>
        }
      >
        <div className="space-y-xs">
          <p className="text-body-md text-on-surface-variant">You&apos;ll lose your place in the queue. You can book again afterwards.</p>
          {actionError && <FormAlert>{actionError}</FormAlert>}
          <label htmlFor="cancelReason" className={labelStyles}>Reason <span className="font-normal text-on-surface-variant">(optional)</span></label>
          <textarea id="cancelReason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className={inputStyles("py-md")} rows={3} />
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
        <div className="space-y-md">
          <p className="break-all text-center font-mono text-body-md text-on-surface">OR {orNumber}</p>
          <dl className="grid grid-cols-2 gap-md border-t border-outline-variant pt-md">
            <InfoField label="Doctor" value={booking.doctorName} />
            <InfoField label="Visit date" value={formatClinicDate(booking.appointmentDate)} />
            <InfoField label="Amount" value={<span className="tabular-nums">{formatPeso(booking.totalFee)}</span>} />
            <InfoField label="Method" value={booking.paymentMode === "PayAtClinic" ? "Pay at clinic" : "Online"} />
            {booking.waivedReason && <InfoField label="Waived reason" value={booking.waivedReason} className="col-span-2" />}
          </dl>
        </div>
      </Modal>
    </AppShell>
  );
}

