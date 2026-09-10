"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayNameToIndex } from "@/lib/days";
import type { DoctorScheduleDay } from "@/data/types";

export type CreateDoctorResult = { success: true; doctorId: string } | { success: false; error: string };

export interface CreateDoctorInput {
  email: string;
  fullName: string;
  specialization: string;
  consultationFee: number;
  bio: string;
  licenseNumber: string;
  ptrNumber: string;
  s2Number: string;
  slotDurationMinutes: number;
  schedule: DoctorScheduleDay[];
}

// Implementation-Phases/05-doctors-staff.md: creating one doctor fans out
// into 4 tables (auth.users -> staff_accounts -> doctors -> doctor_services +
// doctor_schedules). All of them cascade off auth.users (see schema.sql's
// `on delete cascade` chain), so on any failure, deleting the invited auth
// user cleanly rolls back everything already written — no orphaned
// half-created doctor left behind. This consolidates what used to be a
// separate inviteStaffMember() call + two client-side inserts in
// DoctorForm.tsx into one transactional-ish server action.
export async function createDoctor(input: CreateDoctorInput): Promise<CreateDoctorResult> {
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return { success: false, error: "Not signed in." };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single();
  if (callerProfile?.role !== "Admin") return { success: false, error: "Only an admin can create doctors." };

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(input.email);
  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? "Could not send invite." };
  }
  const userId = authData.user.id;

  async function rollback(message: string): Promise<CreateDoctorResult> {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: message };
  }

  const { error: profileError } = await admin.from("profiles").insert({ id: userId, role: "Doctor" });
  if (profileError) return rollback("Could not create the account profile.");

  const { data: staffRow, error: staffError } = await admin
    .from("staff_accounts")
    .insert({ user_id: userId, full_name: input.fullName, email: input.email, role: "Doctor", status: "Invited" })
    .select("staff_id")
    .single();
  if (staffError || !staffRow) return rollback("Could not create the staff record.");
  const doctorId = staffRow.staff_id;

  const { error: doctorError } = await admin.from("doctors").insert({
    doctor_id: doctorId,
    specialization: input.specialization,
    consultation_fee: input.consultationFee,
    bio: input.bio || null,
    license_number: input.licenseNumber || null,
    ptr_number: input.ptrNumber || null,
    s2_number: input.s2Number || null,
    slot_duration_minutes: input.slotDurationMinutes,
  });
  if (doctorError) return rollback("Could not create the doctor profile.");

  const { error: scheduleError } = await admin.from("doctor_schedules").insert(
    input.schedule.map((d) => ({
      doctor_id: doctorId,
      day_of_week: dayNameToIndex(d.day),
      is_active: d.isActive,
      start_time: d.startTime,
      end_time: d.endTime,
    })),
  );
  if (scheduleError) return rollback("Could not save the weekly schedule.");

  return { success: true, doctorId };
}
