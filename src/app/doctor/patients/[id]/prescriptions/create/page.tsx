import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PrescriptionForm } from "@/components/doctor/PrescriptionForm";
import { createClient } from "@/lib/supabase/server";
import type { PrescriptionGroup } from "@/data/types";
import type { Database } from "@/data/supabase-types";

type DbLineItem = Database["public"]["Tables"]["prescription_line_items"]["Row"];

export default async function CreatePrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bookingId?: string; copyFrom?: string }>;
}) {
  const { id } = await params;
  const { bookingId, copyFrom } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: staff } = await supabase.from("staff_accounts").select("staff_id").eq("user_id", user.id).single();
  if (!staff) redirect("/login");

  const { data: patient } = await supabase.from("patients").select("patient_id").eq("patient_id", id).maybeSingle();
  if (!patient) notFound();

  let copyFromGroup: PrescriptionGroup | undefined;
  if (copyFrom) {
    const { data: g } = await supabase.from("prescription_groups").select("*, prescription_line_items(*)").eq("group_id", copyFrom).maybeSingle();
    if (g) {
      copyFromGroup = {
        id: g.group_id,
        patientId: g.patient_id,
        doctorId: g.doctor_id,
        bookingId: g.booking_id,
        createdAt: g.created_at.slice(0, 10),
        items: (g.prescription_line_items ?? []).map((i: DbLineItem) => ({
          id: i.id,
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
      <PrescriptionForm mode="create" patientId={patient.patient_id} doctorId={staff.staff_id} bookingId={bookingId} copyFromGroup={copyFromGroup} />
    </AppShell>
  );
}
