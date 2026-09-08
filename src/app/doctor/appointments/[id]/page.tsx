import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/server";
import { one, serviceNames } from "@/lib/one";

// Stitch appointment_overview_states — 3 states driven by booking status,
// per React-Conversion-Guide.md §4. Screen 3b (View/Edit split on Completed)
// is the single most important screen in the doctor portal per the UX
// Redesign Proposal — the two buttons below are deliberately different
// weights (secondary vs primary), never a stylistic variation of one action.
export default async function AppointmentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: staff } = await supabase.from("staff_accounts").select("staff_id").eq("user_id", user.id).single();
  if (!staff) redirect("/login");

  // Booking + consultation in parallel — sequential awaits were adding an
  // extra Supabase round-trip before any HTML could stream back.
  const [{ data: b }, { data: consultation }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, patients(first_name, last_name, contact_number, email), booking_services(services(name)), payments(status)")
      .eq("booking_id", id)
      .eq("doctor_id", staff.staff_id)
      .maybeSingle(),
    supabase.from("consultations").select("chief_complaint, assessment, plan").eq("booking_id", id).maybeSingle(),
  ]);
  if (!b) notFound();

  const patientRel = one(b.patients);
  const serviceNamesList = serviceNames(b.booking_services);
  const paymentRel = one(b.payments);

  const booking = {
    id: b.booking_id,
    patientName: patientRel ? `${patientRel.first_name} ${patientRel.last_name}` : "Unknown patient",
    patientContact: patientRel?.contact_number ?? "",
    patientEmail: patientRel?.email ?? "",
    serviceNames: serviceNamesList,
    appointmentDate: b.appointment_date,
    slotStartTime: b.slot_start_time.slice(0, 5),
    status: b.status,
    paymentStatus: paymentRel?.status ?? "Unpaid",
    queueNumber: b.queue_number,
    totalFee: Number(b.total_fee),
    amountDue: Number(b.amount_due),
  };

  const isActive = ["Confirmed", "CheckedIn", "InProgress"].includes(booking.status);
  const isCompleted = booking.status === "Completed";
  const isClosed = ["Cancelled", "NoShow"].includes(booking.status);

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-[40rem] space-y-lg">
        <Link href="/doctor/appointments" className="text-label-md text-primary hover:underline">
          ← Back to appointments
        </Link>

        {/* Doctor.md §3: "Hero shows patient/date/queue/status/payment/service
            chips, patient contact chips, fee breakdown" — patient identity
            was previously missing entirely from this page. */}
        <Card>
          <div className="mb-md flex items-start justify-between">
            <div>
              <h1 className="text-headline-md text-on-surface">{booking.patientName}</h1>
              <p className="text-body-md text-on-surface-variant">{booking.serviceNames.join(", ")}</p>
              <p className="text-body-md text-on-surface-variant">{booking.appointmentDate} · {booking.slotStartTime}</p>
            </div>
            <StatusPill status={booking.status} />
          </div>
          <div className="mb-md flex flex-wrap gap-md text-label-md text-on-surface-variant">
            {booking.queueNumber && <span>Queue #{booking.queueNumber}</span>}
            <StatusPill status={booking.paymentStatus} />
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
            <Link href={`/doctor/consultation/${booking.id}?mode=complete`}>
              <Button className="w-full">Open Consultation</Button>
            </Link>
          )}
          {isCompleted && (
            <div className="flex flex-col gap-md sm:flex-row">
              <Link href={`/doctor/consultation/${booking.id}?mode=view`} className="flex-1">
                <Button variant="secondary" className="w-full">
                  View Consultation
                </Button>
              </Link>
              <Link href={`/doctor/consultation/${booking.id}?mode=amend`} className="flex-1">
                <Button className="w-full">Edit / Amend</Button>
              </Link>
            </div>
          )}
          {isClosed && (
            <Button disabled className="w-full">
              Appointment Ready
            </Button>
          )}
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
      </div>
    </AppShell>
  );
}
