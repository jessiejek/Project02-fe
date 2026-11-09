"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { queryBookingById, updateBookingStatus, rescheduleBooking } from "@/lib/data/bookings";
import { confirmPayment, waivePayment } from "@/lib/data/payments";
import { RescheduleBookingModal } from "@/components/bookings/RescheduleBookingModal";
import { Icon } from "@/components/ui/Icon";
import { InfoField } from "@/components/ui/InfoField";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatClinicDateTime, formatClockTime, formatPeso } from "@/lib/format";

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
  const router = useRouter();
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined);
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveError, setWaiveError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [waiving, setWaiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [receiptTime, setReceiptTime] = useState("");

  const load = useCallback(async () => {
      const supabase = null as never;
      let b;
      try {
        b = await queryBookingById(supabase, id);
        setLoadError(false);
      } catch {
        setLoadError(true);
        return;
      }
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
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="staff">
        <div className="mx-auto max-w-[48rem] space-y-lg">
          {loadError ? (
            <ErrorState
              title="This booking didn’t load"
              message="Check the connection to the clinic server, then try again."
              retrying={retrying}
              onRetry={async () => { setRetrying(true); await load(); setRetrying(false); }}
            />
          ) : (
            <div className="space-y-lg" aria-busy="true"><SkeletonCard lines={3} /><SkeletonCard lines={4} /></div>
          )}
        </div>
      </AppShell>
    );
  }

  async function quickStatus(status: string) {
    setPending(status);
    setPageError("");
    try {
      await updateBooking({ status });
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not update the booking.");
    } finally {
      setPending(null);
    }
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

  const settled = booking.paymentStatus === "Paid" || booking.paymentStatus === "Waived";
  const hasActions = isConfirmed || isCheckedIn || isCompletedUnpaid || (isCompleted && settled);

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <Link href="/staff/queue" className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />
          Today’s queue
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 space-y-xs">
            <p className="text-label-md text-on-surface-variant">Booking for</p>
            <h1 className="text-balance break-words text-headline-lg-mobile text-on-surface sm:text-headline-lg">{booking.patientName || "Patient"}</h1>
            <p className="text-body-md tabular-nums text-on-surface-variant">
              {formatClinicDate(booking.appointmentDate)} · {formatClockTime(booking.slotStartTime)}
              {booking.queueNumber && <> · {booking.queueNumber}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-xs">
            <StatusPill status={booking.status} />
            <StatusPill status={booking.paymentStatus} />
          </div>
        </header>

        {/* Actions first: the front desk opens this page to do one thing. */}
        {hasActions && (
          <Card className="space-y-md">
            <h2 className="text-headline-sm text-on-surface">Next step</h2>
            {pageError && <FormAlert>{pageError}</FormAlert>}
            <div className="flex flex-wrap gap-sm">
              {isConfirmed && (
                <>
                  <Button loading={pending === "CheckedIn"} disabled={pending !== null} onClick={() => quickStatus("CheckedIn")}>Check in</Button>
                  <Button variant="secondary" onClick={() => setRescheduleOpen(true)}>Reschedule</Button>
                  <Button variant="secondary" onClick={() => setNoShowOpen(true)}>Mark no-show</Button>
                </>
              )}
              {isCheckedIn && (
                <Button variant="secondary" loading={pending === "Confirmed"} disabled={pending !== null} onClick={() => quickStatus("Confirmed")}>
                  Undo check-in
                </Button>
              )}
              {isCompletedUnpaid && (
                <>
                  <Button onClick={() => { setPayError(""); setConfirmPaymentOpen(true); }}>Record payment</Button>
                  <Button variant="secondary" onClick={() => setWaiveOpen(true)}>Waive professional fee</Button>
                </>
              )}
              {isCompleted && settled && (
                <Button variant="secondary" onClick={() => { setReceiptTime(new Date().toISOString()); setReceiptOpen(true); }}>
                  <Icon name="print" className="text-[16px]" />
                  View receipt
                </Button>
              )}
              {(isConfirmed || isCheckedIn) && (
                <Button variant="ghost" className="text-error" onClick={() => { setCancelError(""); setCancelOpen(true); }}>
                  Cancel booking
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Patient card — Staff.md §3: name, code, contact, email, sex, DOB */}
        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">Patient</h2>
          <dl className="grid grid-cols-1 gap-md min-[420px]:grid-cols-2 sm:grid-cols-3">
            <InfoField label="Patient code" value={booking.patientCode} mono />
            <InfoField label="Sex" value={booking.patientSex} />
            <InfoField label="Date of birth" value={booking.patientDob ? formatClinicDate(booking.patientDob) : ""} />
            <InfoField label="Contact" value={booking.patientContact} />
            <InfoField label="Email" value={booking.patientEmail} className="sm:col-span-2" />
          </dl>
        </Card>

        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          {/* Doctor card — distinct from Patient card per Staff.md §3 */}
          <Card>
            <h2 className="mb-md text-headline-sm text-on-surface">Doctor</h2>
            <dl className="grid grid-cols-1 gap-md">
              <InfoField label="Name" value={booking.doctorName} />
              <InfoField label="Specialty" value={booking.doctorSpecialization} />
            </dl>
          </Card>

          {/* Payment info — Staff.md §3: mode, status, amount, OR number, waive reason */}
          <Card>
            <h2 className="mb-md text-headline-sm text-on-surface">Payment</h2>
            <dl className="grid grid-cols-2 gap-md">
              <InfoField label="Mode" value={booking.paymentMode === "PayAtClinic" ? "Pay at clinic" : "Online"} />
              <InfoField label="Amount due" value={<span className="tabular-nums">{formatPeso(booking.amountDue)}</span>} />
              {settled && booking.orNumber && <InfoField label="OR number" value={booking.orNumber} mono />}
            </dl>
            {booking.paymentStatus === "Waived" && booking.waivedReason && (
              <p className="mt-md rounded-lg bg-surface-container-low px-md py-sm text-body-sm text-on-surface">
                Professional fee waived: {booking.waivedReason}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        isOpen={confirmPaymentOpen}
        onClose={() => { if (!paySubmitting) setConfirmPaymentOpen(false); }}
        title={`Record payment of ${formatPeso(booking.amountDue)}`}
        footer={
          <>
            <Button variant="secondary" disabled={paySubmitting} onClick={() => setConfirmPaymentOpen(false)}>
              Back
            </Button>
            <Button
              loading={paySubmitting}
              onClick={async () => {
                setPayError("");
                setPaySubmitting(true);
                try {
                  await updatePayment({
                    status: "Paid",
                    paymentMethod: paymentMethod,
                    amountReceived: Number(amountReceived) || booking.amountDue,
                    confirmNotes: notes || undefined,
                    withOrNumber: true,
                  });
                  setConfirmPaymentOpen(false);
                  setReceiptTime(new Date().toISOString());
                  setReceiptOpen(true);
                } catch (e) {
                  setPayError(e instanceof Error ? e.message : "Could not record the payment.");
                } finally {
                  setPaySubmitting(false);
                }
              }}
            >
              Record payment
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {payError && <FormAlert>{payError}</FormAlert>}
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
            <p className={hintStyles}>Shown on the printed receipt.</p>
          </div>
          <div className="space-y-xs">
            <label htmlFor="payNotes" className={labelStyles}>Notes <span className="font-normal text-on-surface-variant">(optional)</span></label>
            <textarea id="payNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputStyles("py-md")} rows={2} />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={waiveOpen}
        onClose={() => { setWaiveOpen(false); setReasonText(""); setWaiveError(""); }}
        title="Waive the professional fee"
        footer={
          <>
            <Button variant="secondary" disabled={waiving} onClick={() => { setWaiveOpen(false); setReasonText(""); setWaiveError(""); }}>
              Back
            </Button>
            <Button
              disabled={reasonText.trim().length < 5}
              loading={waiving}
              onClick={async () => {
                setWaiveError("");
                setWaiving(true);
                try {
                  await updatePayment({ status: "Waived", waivedReason: reasonText, withOrNumber: true });
                  setWaiveOpen(false);
                  setReasonText("");
                } catch (e) {
                  // The API only lets front desk record a waiver the doctor already decided (403 otherwise).
                  setWaiveError(e instanceof Error ? e.message : "Could not waive the fee.");
                } finally {
                  setWaiving(false);
                }
              }}
            >
              Record waiver
            </Button>
          </>
        }
      >
        <div className="space-y-xs">
          <p className="text-body-md text-on-surface-variant">Only record a waiver the doctor has already approved.</p>
          <label htmlFor="waiveReason" className={labelStyles}>Reason</label>
          <textarea id="waiveReason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("py-md")} rows={3} />
          <p className={hintStyles}>At least 5 characters.</p>
          {waiveError && <FormAlert>{waiveError}</FormAlert>}
        </div>
      </Modal>

      <Modal
        isOpen={cancelOpen}
        onClose={() => { if (!cancelling) { setCancelOpen(false); setReasonText(""); } }}
        title="Cancel this booking?"
        footer={
          <>
            <Button variant="secondary" disabled={cancelling} onClick={() => { setCancelOpen(false); setReasonText(""); }}>
              Keep booking
            </Button>
            <Button
              variant="danger"
              disabled={reasonText.trim().length < 5}
              loading={cancelling}
              onClick={async () => {
                setCancelError("");
                setCancelling(true);
                try {
                  await updateBooking({ status: "Cancelled", cancellationReason: reasonText });
                  setCancelOpen(false);
                  setReasonText("");
                } catch (e) {
                  setCancelError(e instanceof Error ? e.message : "Could not cancel the booking.");
                } finally {
                  setCancelling(false);
                }
              }}
            >
              Cancel booking
            </Button>
          </>
        }
      >
        <div className="space-y-xs">
          <p className="text-body-md text-on-surface-variant">The booking will end as Cancelled. Your reason is kept on the booking.</p>
          <label htmlFor="cancelReason" className={labelStyles}>Reason</label>
          <textarea id="cancelReason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("py-md")} rows={3} />
          <p className={hintStyles}>At least 5 characters.</p>
          {cancelError && <FormAlert>{cancelError}</FormAlert>}
        </div>
      </Modal>

      <Modal
        isOpen={noShowOpen}
        onClose={() => { if (!actionSubmitting) { setNoShowOpen(false); setReasonText(""); setActionError(""); } }}
        title="Mark as no-show?"
        footer={
          <>
            <Button variant="secondary" disabled={actionSubmitting} onClick={() => { setNoShowOpen(false); setReasonText(""); setActionError(""); }}>Back</Button>
            <Button
              variant="danger"
              loading={actionSubmitting}
              onClick={async () => {
                setActionError("");
                setActionSubmitting(true);
                try {
                  await updateBooking({ status: "NoShow", cancellationReason: reasonText.trim() || undefined });
                  setNoShowOpen(false);
                  setReasonText("");
                } catch (e) {
                  setActionError(e instanceof Error ? e.message : "Could not update booking.");
                } finally {
                  setActionSubmitting(false);
                }
              }}
            >
              Mark no-show
            </Button>
          </>
        }
      >
        <div className="space-y-xs">
          <p className="text-body-md text-on-surface-variant">The patient didn’t arrive for this appointment.</p>
          {actionError && <FormAlert>{actionError}</FormAlert>}
          <label htmlFor="noShowReason" className={labelStyles}>Reason <span className="font-normal text-on-surface-variant">(optional)</span></label>
          <textarea id="noShowReason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("py-md")} rows={3} />
        </div>
      </Modal>

      <RescheduleBookingModal
        isOpen={rescheduleOpen}
        submitting={actionSubmitting}
        error={actionError}
        onClose={() => { setRescheduleOpen(false); setActionError(""); }}
        onConfirm={async (appointmentDate, reason) => {
          setActionError("");
          setActionSubmitting(true);
          try {
            const result = await rescheduleBooking(id, appointmentDate, reason || undefined);
            setBooking((prev) => (prev ? { ...prev, status: "Rescheduled" } : prev));
            setRescheduleOpen(false);
            setActionSubmitting(false);
            router.push(`/staff/bookings/${result.new_booking_id}`);
          } catch (e) {
            setActionError(e instanceof Error ? e.message : "Could not reschedule.");
            setActionSubmitting(false);
          }
        }}
      />

      {/* Receipt/print modal — Staff.md §3: OR number, patient/doctor, services,
          date, amount, method, reference, staff name, timestamp. */}
      <Modal isOpen={receiptOpen} onClose={() => setReceiptOpen(false)} title="Receipt" footer={<Button onClick={() => setReceiptOpen(false)}>Close</Button>}>
        <div className="space-y-md">
          <p className="text-center font-mono text-headline-sm text-on-surface">OR {booking.orNumber ?? "—"}</p>
          <dl className="grid grid-cols-2 gap-md border-t border-outline-variant pt-md">
            <InfoField label="Patient" value={booking.patientName} />
            <InfoField label="Doctor" value={booking.doctorName} />
            <InfoField label="Visit date" value={formatClinicDate(booking.appointmentDate)} />
            <InfoField label="Amount" value={<span className="tabular-nums">{formatPeso(booking.amountDue)}</span>} />
            <InfoField label="Method" value={paymentMethod === "BankTransfer" ? "Bank transfer" : paymentMethod} />
            {referenceNumber && <InfoField label="Reference" value={referenceNumber} mono />}
            <InfoField label="Issued" value={formatClinicDateTime(receiptTime || new Date().toISOString())} className="col-span-2" />
          </dl>
        </div>
      </Modal>
    </AppShell>
  );
}

