import Link from "next/link";
import { visitDate } from "@/components/doctor/appointments/model";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { getServerSession } from "@/lib/auth/session";
import { queryBookingById } from "@/lib/data/bookings";
import {
  formatConsultationDiagnosisLabel,
  queryConsultationByBooking,
  queryConsultations,
  queryRxGroups,
  shortRxSummaryForItems,
} from "@/lib/data/clinical";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppointmentPrintActions } from "@/components/doctor/AppointmentPrintActions";

// Stitch appointment_overview_states — 3 states driven by booking status,
// per React-Conversion-Guide.md §4. Screen 3b (View/Edit split on Completed)
// is the single most important screen in the doctor portal per the UX
// Redesign Proposal — the two buttons below are deliberately different
// weights (secondary vs primary), never a stylistic variation of one action.
export default async function AppointmentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getServerSession();
  if (!session || (session.role !== "Doctor" && session.role !== "Admin")) redirect("/login");

  const supabase = null as never;
  const b = await queryBookingById(supabase, id);
  if (!b || (session.role === "Doctor" && session.staffId && b.doctor_id !== session.staffId)) notFound();

  const [consultation, priorConsults, patientRxGroups] = await Promise.all([
    queryConsultationByBooking(supabase, id),
    queryConsultations(supabase, { patientId: b.patient_id }),
    queryRxGroups(supabase, { patientId: b.patient_id }),
  ]);

  const booking = {
    id: b.booking_id,
    patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "Unknown patient",
    patientContact: b.patients?.contact_number ?? "",
    patientEmail: b.patients?.email ?? "",
    appointmentDate: b.appointment_date,
    slotStartTime: (b.slot_start_time ?? "").slice(0, 5),
    status: b.status,
    paymentStatus: b.payments?.status ?? "Not recorded",
    queueNumber: b.queue_number,
    totalFee: Number(b.total_fee),
    amountDue: Number(b.amount_due),
  };

  const isActive = ["Confirmed", "CheckedIn", "InProgress"].includes(booking.status);
  const isCompleted = booking.status === "Completed";
  const isClosed = ["Cancelled", "NoShow", "Rescheduled"].includes(booking.status);

  const rxByBookingId = new Map(patientRxGroups.map((g) => [g.booking_id, g]));
  const previousConsultations = priorConsults
    .filter((c) => c.booking_id !== booking.id)
    .sort((a, b) => {
      const da = a.bookings?.appointment_date ?? a.created_at;
      const db = b.bookings?.appointment_date ?? b.created_at;
      return db.localeCompare(da);
    });

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-doctor-heading space-y-lg">
        <Link href="/doctor/appointments" className="inline-flex min-h-11 items-center gap-xs text-label-md text-primary hover:underline">
          <Icon name="chevron_left" className="h-4 w-4" />Back to appointments
        </Link>

        {/* Doctor.md §3: "Hero shows patient/date/queue/status/payment/service
            chips, patient contact chips, fee breakdown" — patient identity
            was previously missing entirely from this page. */}
        <Card>
          <div className="mb-lg flex flex-wrap items-start justify-between gap-md">
            <div>
              <h1 className="text-balance text-headline-lg font-semibold text-on-surface">{booking.patientName}</h1>
              <p className="text-body-md text-on-surface-variant">{visitDate(booking.appointmentDate)}{booking.slotStartTime && booking.slotStartTime !== "00:00" ? ` · ${booking.slotStartTime}` : ""}</p>
            </div>
            <StatusPill status={booking.status} />
          </div>
          <div className="mb-md flex flex-wrap gap-md text-label-md text-on-surface-variant">
            {booking.queueNumber && <span className="tabular-nums">Queue {booking.queueNumber}</span>}
            <span>Payment: {booking.paymentStatus}</span>
          </div>
          <div className="flex flex-wrap gap-md border-t border-outline-variant pt-md text-label-md text-on-surface-variant">
            <span className="flex items-center gap-xs">
              <Icon name="call" className="text-[16px]" />
              {booking.patientContact}
            </span>
            <span className="flex items-center gap-xs">
              <Icon name="mail" className="text-[16px]" />
              {booking.patientEmail}
            </span>
          </div>
          <div className="mt-md flex items-center justify-between rounded-lg bg-surface-container-low px-md py-sm text-body-md">
            <span className="text-on-surface-variant">Fee breakdown</span>
            <span className="font-medium text-on-surface">₱{booking.totalFee} total · ₱{booking.amountDue} due</span>
          </div>
        </Card>

        <Card>
          {isActive && (
            <Link href={`/doctor/consultation2/${booking.id}?mode=complete`} className={buttonStyles("primary", "w-full")}>
Open Consultation
</Link>
          )}
          {isCompleted && (
            <div className="flex flex-col gap-md sm:flex-row">
              <Link href={`/doctor/consultation2/${booking.id}?mode=view`} className={buttonStyles("secondary", "flex-1 w-full")}>

                  View Consultation

</Link>
              <Link href={`/doctor/consultation2/${booking.id}?mode=amend`} className={buttonStyles("primary", "flex-1 w-full")}>
Edit / Amend
</Link>
            </div>
          )}
          {isCompleted && (
            <AppointmentPrintActions bookingId={booking.id} className="mt-md flex flex-wrap gap-sm border-t border-outline-variant pt-md" />
          )}
          {isClosed && (
            <>
              <p className="text-body-md text-on-surface-variant">
                {booking.status === "Rescheduled"
                  ? "This appointment was rescheduled — open the new booking from your appointments list."
                  : "This appointment is closed (cancelled or no-show)."}
              </p>
            </>
          )}
          {!isActive && !isCompleted && !isClosed && (
            <div className="space-y-md">
              <p className="text-body-md text-on-surface-variant">
                This booking is still {booking.status} — open the consultation after staff confirms or checks the patient in.
              </p>
            </div>
          )}
          {/*JJQR - END*/}
        </Card>

        {isCompleted && consultation && (
          <Card className="space-y-sm text-body-md text-on-surface-variant">
            <p><strong>Chief Complaint:</strong> {consultation.chief_complaint}</p>
            <p><strong>Assessment:</strong> {consultation.assessment}</p>
            <p><strong>Plan:</strong> {consultation.plan}</p>
          </Card>
        )}

        {isClosed && (
          <p className="text-body-md text-on-surface-variant">No consultation record for this appointment.</p>
        )}

        {/*JJQR - AI (Oct 31, 2026)*/}
        <section className="space-y-md">
          <h2 className="text-headline-sm text-on-surface">Previous consultations</h2>
          {previousConsultations.length === 0 ? (
            <EmptyState icon="clinical_notes" message="No previous consultations for this patient." />
          ) : (
            <div className="space-y-sm">
              {previousConsultations.map((c) => {
                const date = c.bookings?.appointment_date ?? c.created_at.slice(0, 10);
                const doctorName = c.doctors?.staff_accounts?.full_name ?? "—";
                const summaryLine = [c.chief_complaint, c.assessment].filter(Boolean).join(" · ") || "—";
                const diagnoses = (c.consultation_diagnoses ?? [])
                  .map((d) => formatConsultationDiagnosisLabel(d))
                  .filter(Boolean);
                const rxSummary = shortRxSummaryForItems(rxByBookingId.get(c.booking_id)?.prescription_line_items);
                const followUpDate = c.follow_ups?.follow_up_date;
                const followUpNote = c.follow_ups?.instructions;
                return (
                  <div
                    key={c.consultation_id}
                    className="rounded-xl border border-outline-variant p-md transition-colors hover:bg-surface-container-low"
                  >
                    <Link
                      href={`/doctor/consultation2/${c.booking_id}?mode=view`}
                      className="block"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-sm">
                        <span className="text-label-md font-medium text-on-surface">{date}</span>
                        <span className="text-label-sm text-on-surface-variant">{doctorName}</span>
                      </div>
                      <p className="mt-xs text-body-md text-on-surface-variant">{summaryLine}</p>
                      {diagnoses.length > 0 && (
                        <p className="mt-xs text-label-sm text-on-surface-variant">
                          ICD-10: {diagnoses.join("; ")}
                        </p>
                      )}
                      <p className="mt-xs text-label-sm text-on-surface-variant">Rx: {rxSummary}</p>
                      {(followUpDate || followUpNote) && (
                        <p className="mt-xs text-label-sm text-on-surface-variant">
                          Follow-up: {followUpDate ?? "—"}
                          {followUpNote ? ` — ${followUpNote}` : ""}
                        </p>
                      )}
                    </Link>
                    <AppointmentPrintActions
                      bookingId={c.booking_id}
                      compact
                      className="mt-sm flex flex-wrap gap-sm border-t border-outline-variant pt-sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {/*JJQR - END*/}
      </div>
    </AppShell>
  );
}
