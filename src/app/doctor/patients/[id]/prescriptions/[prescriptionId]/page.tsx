import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PrescriptionForm } from "@/components/doctor/PrescriptionForm";
import { getServerSession } from "@/lib/auth/session";
import { queryPatientById } from "@/lib/data/patients";
import { queryRxGroupById } from "@/lib/data/clinical";

export default async function EditPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string; prescriptionId: string }>;
}) {
  const { id, prescriptionId } = await params;

  const session = await getServerSession();
  if (!session || (session.role !== "Doctor" && session.role !== "Admin") || !session.staffId) redirect("/login");

  const [patient, g] = await Promise.all([
    queryPatientById(null as never, id),
    queryRxGroupById(null as never, prescriptionId),
  ]);
  if (!patient || !g) notFound();

  const group = {
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

  return (
    <AppShell role="doctor">
      <PrescriptionForm mode="edit" patientId={patient.patient_id} doctorId={session.staffId} group={group} />
    </AppShell>
  );
}
