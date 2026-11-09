"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { InfoField } from "@/components/ui/InfoField";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatPeso } from "@/lib/format";
import { showPaymentStatus } from "@/lib/paymentDisplay";
import { BookingTimeline } from "@/components/ui/BookingTimeline";
import { queryBookingById, updateBookingStatus, rescheduleBooking } from "@/lib/data/bookings";
import { waivePayment, refundPayment } from "@/lib/data/payments";
import { printHtml, escapeHtml } from "@/lib/print";
import { RescheduleBookingModal } from "@/components/bookings/RescheduleBookingModal";

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
  const router = useRouter();
  const [booking, setBooking] = useState<BookingView | null | undefined>(undefined);
  const [reasonModal, setReasonModal] = useState<"confirm" | "reject" | "cancel" | null>(null);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      let b;
      try {
        b = await queryBookingById(supabase, id);
      } catch {
        setLoadError(true);
        return;
      }
      setLoadError(false);
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
  }, [id, reloadKey]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="admin">
        <div className="mx-auto max-w-doctor-record">
          {loadError
            ? <ErrorState title="Booking unavailable" message="This booking could not be loaded. Nothing has changed; try again." onRetry={() => { setLoadError(false); setReloadKey((k) => k + 1); }} />
            : <><p className="sr-only" role="status">Loading booking…</p><SkeletonCard lines={5} /></>}
        </div>
      </AppShell>
    );
  }

  /** Pending + error feedback for the one-click status actions (Confirm, Complete). */
  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setPageError("");
    try {
      await fn();
    } catch (e) {
      setPageError(e instanceof Error && e.message ? e.message : "The booking could not be updated. Try again.");
    } finally {
      setBusy(null);
    }
  }

  /** Same feedback for reason modals: closes only after the write succeeds. */
  async function submitModal(fn: () => Promise<void>, close: () => void) {
    setActionSubmitting(true);
    setActionError("");
    try {
      await fn();
      close();
      setReasonText("");
      setRefundAmount("");
    } catch (e) {
      setActionError(e instanceof Error && e.message ? e.message : "The change could not be saved. Try again.");
    } finally {
      setActionSubmitting(false);
    }
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
  const showPayment = showPaymentStatus(booking.status, booking.paymentStatus);
  const anyBusy = busy !== null;

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-doctor-record space-y-lg">
        <Link href="/admin/bookings" className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />All bookings
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 space-y-xs">
            <p className="text-label-md text-on-surface-variant">Booking for</p>
            <h1 className="break-words text-headline-lg-mobile text-on-surface sm:text-headline-lg">{booking.patientName || "Unknown patient"}</h1>
            <p className="text-body-md text-on-surface-variant">
              <span className="tabular-nums">{formatClinicDate(booking.appointmentDate)}</span> · {booking.doctorName || "Doctor not recorded"}
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            <StatusPill status={booking.status} />
            {showPayment && <StatusPill status={booking.paymentStatus} />}
          </div>
        </header>

        {pageError && <FormAlert>{pageError}</FormAlert>}

        {timelineIndex >= 0 && (
          <Card>
            <h2 className="sr-only">Progress</h2>
            <BookingTimeline steps={TIMELINE} currentIndex={timelineIndex} />
          </Card>
        )}

        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <Card>
            <h2 className="mb-md text-headline-sm text-on-surface">Patient</h2>
            <dl className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <InfoField label="Patient code" value={booking.patientCode} mono />
              <InfoField label="Contact" value={booking.patientContact} />
              <InfoField label="Email" value={booking.patientEmail} className="break-all sm:col-span-2" />
            </dl>
            <Link href={`/admin/patients/${booking.patientId}`} className="mt-md inline-flex min-h-11 items-center text-label-md font-medium text-primary hover:underline">
              Open patient record
            </Link>
          </Card>

          <Card>
            <h2 className="mb-md text-headline-sm text-on-surface">Visit and payment</h2>
            <dl className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <InfoField label="Doctor" value={booking.doctorName} />
              <InfoField label="Specialty" value={booking.doctorSpecialization} />
              <InfoField label="Payment mode" value={booking.paymentMode === "PayAtClinic" ? "Pay at clinic" : "Online"} />
              <InfoField label="Amount due" value={<span className="tabular-nums">{formatPeso(booking.amountDue)}</span>} />
              {(booking.paymentStatus === "Paid" || booking.paymentStatus === "Waived") && booking.orNumber && (
                <InfoField label="OR number" value={booking.orNumber} mono />
              )}
            </dl>
          </Card>
        </div>

        <Card className="space-y-md">
          <h2 className="text-headline-sm text-on-surface">Actions</h2>
          <div className="flex flex-wrap gap-sm">
          {booking.status === "Pending" && (
            <>
              <Button loading={busy === "confirm"} disabled={anyBusy} onClick={() => act("confirm", () => updateBooking({ status: "Confirmed" }))}>Confirm booking</Button>
              <Button variant="secondary" disabled={anyBusy} onClick={() => setReasonModal("reject")}>Reject booking</Button>
              <Button variant="ghost" className="text-status-danger hover:bg-status-danger-surface" disabled={anyBusy} onClick={() => setReasonModal("cancel")}>Cancel booking</Button>
            </>
          )}
          {booking.status === "ProofSubmitted" && (
            <>
              <Button
                loading={busy === "pay"}
                disabled={anyBusy}
                onClick={() => act("pay", async () => {
                  await updateBooking({ status: "Confirmed" });
                  await updatePayment({ status: "Paid", withOrNumber: true });
                })}
              >
                Confirm payment
              </Button>
              <Button variant="secondary" disabled={anyBusy} onClick={() => setReasonModal("reject")}>Reject proof</Button>
            </>
          )}
          {booking.status === "Confirmed" && (
            <>
              <Button loading={busy === "complete"} disabled={anyBusy} onClick={() => act("complete", () => updateBooking({ status: "Completed" }))}>Mark complete</Button>
              <Button variant="secondary" disabled={anyBusy} onClick={() => setNoShowOpen(true)}>Mark no-show</Button>
              <Button variant="secondary" disabled={anyBusy} onClick={() => setRescheduleOpen(true)}>Reschedule</Button>
              <Button variant="ghost" className="text-status-danger hover:bg-status-danger-surface" disabled={anyBusy} onClick={() => setReasonModal("cancel")}>Cancel booking</Button>
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
                <Icon name="print" className="text-[14px]" />Print receipt
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  printHtml(
                    `Appointment Summary ${booking.id}`,
                    `<h1>Appointment Summary</h1>
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
                <Icon name="print" className="text-[14px]" />Print summary
              </Button>
            </>
          )}
          {booking.paymentStatus === "Unpaid" && <Button variant="secondary" disabled={anyBusy} onClick={() => setWaiveOpen(true)}>Waive payment</Button>}
          {booking.paymentStatus === "Paid" && <Button variant="secondary" disabled={anyBusy} onClick={() => setRefundOpen(true)}>Refund payment</Button>}
          </div>
        </Card>
      </div>

      <Modal
        isOpen={reasonModal !== null}
        onClose={() => { if (!actionSubmitting) { setReasonModal(null); setReasonText(""); setActionError(""); } }}
        title={reasonModal === "cancel" ? "Cancel this booking?" : booking.status === "ProofSubmitted" ? "Reject this payment proof?" : "Reject this booking?"}
        footer={
          <>
            <Button variant="secondary" disabled={actionSubmitting} onClick={() => { setReasonModal(null); setReasonText(""); setActionError(""); }}>Back</Button>
            <Button
              variant="danger"
              disabled={!reasonText.trim()}
              loading={actionSubmitting}
              onClick={() => submitModal(async () => {
                // Patient.md's BookingStatus enum has no separate "Rejected" value,
                // so Reject Booking/Reject Proof/Cancel Booking all terminate in
                // "Cancelled" — the only terminal-negative status that exists.
                // Open question (not resolved here, per Gaps.md's own rule against
                // guessing): should "Reject Proof" instead revert the booking to
                // "Pending" so the patient can resubmit, rather than cancelling
                // outright? Left as Cancelled until that's confirmed.
                await updateBooking({ status: "Cancelled", cancellationReason: reasonText });
              }, () => setReasonModal(null))}
            >
              {reasonModal === "cancel" ? "Cancel booking" : "Reject"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          <p className="text-body-md text-on-surface-variant">The booking will end as Cancelled. Your reason is kept on the booking.</p>
          {actionError && <FormAlert>{actionError}</FormAlert>}
          <div className="space-y-xs">
            <label htmlFor="reason-cancel" className={labelStyles}>Reason</label>
            <textarea id="reason-cancel" required value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("py-md")} rows={3} />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={waiveOpen}
        onClose={() => { if (!actionSubmitting) { setWaiveOpen(false); setReasonText(""); setActionError(""); } }}
        title={`Waive ${formatPeso(booking.amountDue)}?`}
        footer={
          <>
            <Button variant="secondary" disabled={actionSubmitting} onClick={() => { setWaiveOpen(false); setReasonText(""); setActionError(""); }}>Cancel</Button>
            <Button
              disabled={!reasonText.trim()}
              loading={actionSubmitting}
              onClick={() => submitModal(() => updatePayment({ status: "Waived", waivedReason: reasonText, withOrNumber: true }), () => setWaiveOpen(false))}
            >
              Waive payment
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {actionError && <FormAlert>{actionError}</FormAlert>}
          <div className="space-y-xs">
            <label htmlFor="reason-waive" className={labelStyles}>Reason</label>
            <textarea id="reason-waive" required value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("py-md")} rows={3} />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={refundOpen}
        onClose={() => { if (!actionSubmitting) { setRefundOpen(false); setReasonText(""); setRefundAmount(""); setActionError(""); } }}
        title="Refund this payment?"
        footer={
          <>
            <Button variant="secondary" disabled={actionSubmitting} onClick={() => { setRefundOpen(false); setReasonText(""); setRefundAmount(""); setActionError(""); }}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reasonText.trim() || !refundAmount.trim()}
              loading={actionSubmitting}
              onClick={() => submitModal(() => updatePayment({ status: "Refunded", refundReason: reasonText, refundAmount: Number(refundAmount) || 0 }), () => setRefundOpen(false))}
            >
              Refund
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {actionError && <FormAlert>{actionError}</FormAlert>}
          <div className="space-y-xs">
            <label htmlFor="refund-amount" className={labelStyles}>Amount (₱)</label>
            <input id="refund-amount" inputMode="decimal" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={String(booking.amountDue)} className={inputStyles("tabular-nums")} />
          </div>
          <div className="space-y-xs">
            <label htmlFor="reason-refund" className={labelStyles}>Reason</label>
            <textarea id="reason-refund" required value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("py-md")} rows={3} />
          </div>
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
        <p className="mb-md text-body-md text-on-surface-variant">Mark this appointment as a no-show?</p>
        {actionError && <FormAlert className="mb-md">{actionError}</FormAlert>}
        <label htmlFor="reason-noshow" className={labelStyles}>Reason <span className="font-normal text-on-surface-variant">(optional)</span></label>
        <textarea id="reason-noshow" value={reasonText} onChange={(e) => setReasonText(e.target.value)} className={inputStyles("mt-xs py-md")} rows={3} />
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
            router.push(`/admin/bookings/${result.new_booking_id}`);
          } catch (e) {
            setActionError(e instanceof Error ? e.message : "Could not reschedule.");
            setActionSubmitting(false);
          }
        }}
      />
    </AppShell>
  );
}
