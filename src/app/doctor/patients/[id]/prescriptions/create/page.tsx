import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PrescriptionForm } from "@/components/doctor/PrescriptionForm";
import { getServerSession } from "@/lib/auth/session";
import { queryPatientById } from "@/lib/data/patients";
import { queryRxGroupById } from "@/lib/data/clinical";
import type { PrescriptionGroup } from "@/data/types";

export default async function CreatePrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bookingId?: string; copyFrom?: string }>;
}) {
  const { id } = await params;
  const { bookingId, copyFrom } = await searchParams;

  const session = await getServerSession();
  if (!session || (session.role !== "Doctor" && session.role !== "Admin") || !session.staffId) redirect("/login");

  const patient = await queryPatientById(null as never, id);
  if (!patient) notFound();

  let copyFromGroup: PrescriptionGroup | undefined;
  if (copyFrom) {
    const g = await queryRxGroupById(null as never, copyFrom);
    if (g) {
      copyFromGroup = {
        id: g.group_id,
        patientId: g.patient_id,
        doctorId: g.doctor_id,
        bookingId: g.booking_id,
        createdAt: g.created_at.slice(0, 10),
        items: (g.prescription_line_items ?? []).map((i) => ({
          id: i.id ?? "",
          rxId: i.medicine_id,
          genericName: i.generic_name,
          dosage: i.dosage,
          quantity: i.quantity,
          instruction: i.instruction ?? "",
          isControlledSubstance: i.is_controlled_substance,
        })),
      };
    }
  }

  return (
    <AppShell role="doctor">
      <PrescriptionForm mode="create" patientId={patient.patient_id} doctorId={session.staffId} bookingId={bookingId} copyFromGroup={copyFromGroup} />
    </AppShell>
  );
}
