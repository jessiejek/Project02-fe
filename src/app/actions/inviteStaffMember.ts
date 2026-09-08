"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteResult = { success: true; staffId: string } | { success: false; error: string };

// Staff/Doctor/Admin are never self-service (Implementation-Phases/02-authentication.md
// §1) — only an existing Admin can provision one of these accounts, and doing
// so needs the service-role key, so this must run server-side. The caller-role
// check below matters even with RLS still off (Phase 11): without it, this
// action would let ANY signed-in (or unauthenticated) caller create arbitrary
// Staff/Doctor/Admin accounts by POSTing to it directly.
export async function inviteStaffMember(input: {
  email: string;
  fullName: string;
  role: "Staff" | "Doctor" | "Admin";
}): Promise<InviteResult> {
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return { success: false, error: "Not signed in." };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single();
  if (callerProfile?.role !== "Admin") return { success: false, error: "Only an admin can send invites." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email);
  if (error || !data.user) {
    return { success: false, error: error?.message ?? "Could not send invite." };
  }

  // Every table below cascades from auth.users (profiles.id, then
  // staff_accounts.user_id, then doctors/doctor_services/doctor_schedules off
  // staff_accounts.staff_id — see schema.sql's `on delete cascade` chain), so
  // deleting the just-invited auth user on any failure here cleanly rolls
  // back the whole thing in one call — no orphaned half-created account left
  // behind (Implementation-Phases/05-doctors-staff.md's explicit warning).
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, role: input.role });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { success: false, error: "Could not create the account profile." };
  }

  const { data: staffRow, error: staffError } = await admin
    .from("staff_accounts")
    .insert({ user_id: data.user.id, full_name: input.fullName, email: input.email, role: input.role, status: "Invited" })
    .select("staff_id")
    .single();
  if (staffError || !staffRow) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { success: false, error: "Could not create the staff record." };
  }

  // Identity only — this deliberately does NOT insert a `doctors` row.
  // When role === "Doctor", the caller (createDoctor.ts) is responsible for
  // inserting `doctors` itself with the real specialization/fee/schedule
  // fields it already collects, using the returned staffId as doctor_id.
  return { success: true, staffId: staffRow.staff_id };
}
