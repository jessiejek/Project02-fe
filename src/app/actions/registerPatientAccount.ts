"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterPatientResult =
  | { success: true; patientId: string }
  | { success: false; error: string };

export interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: "Male" | "Female";
  contactNumber: string;
  email: string;
}

// Patient self-signup used to insert into `profiles` from the browser with
// `role: 'Patient'`. With RLS still off project-wide, a crafted client call
// could insert a different role. This action hardcodes role to Patient and
// never accepts a role string from the client — same idea as inviteStaffMember
// / createDoctor keeping role assignment server-side.
export async function registerPatientAccount(input: RegisterPatientInput): Promise<RegisterPatientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const email = (input.email ?? "").trim().toLowerCase();
  if (user.email && user.email.toLowerCase() !== email) {
    return { success: false, error: "Email does not match the signed-in account." };
  }

  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const contactNumber = (input.contactNumber ?? "").trim();
  if (!firstName || !lastName || !input.dateOfBirth || !input.sex || !contactNumber || !email) {
    return { success: false, error: "Please fill in all required fields." };
  }

  const admin = createAdminClient();

  const { data: existingProfile } = await admin.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (existingProfile) {
    if (existingProfile.role !== "Patient") {
      return { success: false, error: "This account is not a patient account." };
    }
    const { data: existingPatient } = await admin
      .from("patients")
      .select("patient_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingPatient) return { success: true, patientId: existingPatient.patient_id };
  } else {
    const { error: profileError } = await admin.from("profiles").insert({ id: user.id, role: "Patient" });
    if (profileError) {
      return { success: false, error: "Could not create the account profile." };
    }
  }

  // MF-<4 digits> matches admin/patients Add Patient and the old booking wizard.
  const patientCode = `MF-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: patient, error: patientError } = await admin
    .from("patients")
    .insert({
      user_id: user.id,
      patient_code: patientCode,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: input.dateOfBirth,
      sex: input.sex,
      contact_number: contactNumber,
      email,
      is_guest: false,
    })
    .select("patient_id")
    .single();

  if (patientError || !patient) {
    // Roll back the profile we just created so a retry can start clean.
    if (!existingProfile) {
      await admin.from("profiles").delete().eq("id", user.id);
    }
    return { success: false, error: "Your account was created, but the patient profile failed to save. Contact the clinic." };
  }

  return { success: true, patientId: patient.patient_id };
}
